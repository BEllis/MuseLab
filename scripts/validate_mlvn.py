#!/usr/bin/env python3
"""Validate MuseLab .mlvn archives (and related JSON) with actionable feedback.

Accepts:
  - .mlvn zip archives (muselab.json + project.json + prompts.<locale>.json + assets/)
  - Bundle JSON ({ "project", "promptsByLocale", ... })
  - Standalone project.json (manifest only; prompts checks skipped unless --prompts given)

Exit codes:
  0  valid (warnings allowed unless --strict-warnings)
  1  invalid (errors found)
  2  usage / I/O / dependency failure
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping, Sequence

try:
    from jsonschema import Draft202012Validator
    from jsonschema.exceptions import SchemaError
    from referencing import Registry, Resource
except ImportError as exc:  # pragma: no cover
    print(
        "Missing dependency: install with `pip install jsonschema referencing`\n"
        f"({exc})",
        file=sys.stderr,
    )
    sys.exit(2)

def resolve_schema_dir() -> Path:
    """Locate schema files for both the MuseLab repo and the agent pack layout."""
    here = Path(__file__).resolve().parent
    candidates = [
        here / "schemas",  # agent pack: validate_mlvn.py next to schemas/
        here.parents[1] / "apps" / "designer",  # repo: scripts/../apps/designer
    ]
    for candidate in candidates:
        if (candidate / "muselab.story.schema.json").is_file():
            return candidate
    raise FileNotFoundError(
        "Could not find muselab.*.schema.json. Expected apps/designer/ in the repo "
        "or a schemas/ directory next to this script."
    )


SCHEMA_DIR = resolve_schema_dir()
MUSELAB_FORMAT_VERSION = 6
MLVN_SCHEMA_ID = "https://muselab.dev/schemas/mlvn.schema.json"
STORY_SCHEMA_ID = "https://muselab.dev/schemas/story.schema.json"
PROMPTS_SCHEMA_ID = "https://muselab.dev/schemas/prompts.schema.json"
BUNDLE_SCHEMA_ID = "https://muselab.dev/schemas/bundle.schema.json"
DEFAULT_BACKDROP_ID = "muselab-default-backdrop"
DEFAULT_FONT_ID = "muselab-default-font"
RESERVED_ASSET_IDS = {DEFAULT_BACKDROP_ID, DEFAULT_FONT_ID}
PROMPTS_FILE_RE = re.compile(r"^prompts\.([a-z]+(?:-[a-z]+)*)\.json$")
LOCALE_TAG_RE = re.compile(r"^[a-z]+(?:-[a-z]+)*$")


@dataclass
class Issue:
    severity: str  # "error" | "warning"
    path: str
    message: str

    def format(self) -> str:
        return f"[{self.severity.upper()}] {self.path}: {self.message}"


@dataclass
class Report:
    issues: list[Issue] = field(default_factory=list)

    def error(self, path: str, message: str) -> None:
        self.issues.append(Issue("error", path, message))

    def warning(self, path: str, message: str) -> None:
        self.issues.append(Issue("warning", path, message))

    @property
    def errors(self) -> list[Issue]:
        return [i for i in self.issues if i.severity == "error"]

    @property
    def warnings(self) -> list[Issue]:
        return [i for i in self.issues if i.severity == "warning"]

    def ok(self, *, strict_warnings: bool = False) -> bool:
        if self.errors:
            return False
        if strict_warnings and self.warnings:
            return False
        return True


def load_json_bytes(raw: bytes, path: str, report: Report) -> Any | None:
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        report.error(path, f"not valid UTF-8 ({exc})")
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        report.error(path, f"not valid JSON ({exc.msg} at line {exc.lineno} col {exc.colno})")
        return None


def load_json_path(path: Path, report: Report) -> Any | None:
    try:
        raw = path.read_bytes()
    except OSError as exc:
        report.error(str(path), f"cannot read file ({exc})")
        return None
    return load_json_bytes(raw, str(path), report)


def schema_files() -> dict[str, Path]:
    return {
        MLVN_SCHEMA_ID: SCHEMA_DIR / "muselab.mlvn.schema.json",
        STORY_SCHEMA_ID: SCHEMA_DIR / "muselab.story.schema.json",
        PROMPTS_SCHEMA_ID: SCHEMA_DIR / "muselab.prompts.schema.json",
        BUNDLE_SCHEMA_ID: SCHEMA_DIR / "muselab.bundle.schema.json",
    }


def build_registry() -> Registry:
    registry = Registry()
    for schema_id, path in schema_files().items():
        if not path.is_file():
            raise FileNotFoundError(f"Missing schema file: {path}")
        data = json.loads(path.read_text(encoding="utf-8"))
        registry = registry.with_resource(schema_id, Resource.from_contents(data))
    return registry


def validate_against_schema(
    data: Any,
    schema_id: str,
    instance_path: str,
    report: Report,
    registry: Registry,
) -> None:
    try:
        resource = registry[schema_id]
    except KeyError:
        report.error(instance_path, f"schema not loaded: {schema_id}")
        return

    schema = resource.contents
    try:
        validator = Draft202012Validator(schema, registry=registry)
    except SchemaError as exc:
        report.error(instance_path, f"invalid schema {schema_id}: {exc}")
        return

    errors = sorted(validator.iter_errors(data), key=lambda e: list(e.absolute_path))
    for err in errors:
        parts = [str(p) for p in err.absolute_path]
        loc = instance_path if not parts else f"{instance_path}/{'/'.join(parts)}"
        report.error(loc, err.message)


def format_version_checks(
    data: Mapping[str, Any] | None,
    path: str,
    report: Report,
    *,
    expected_schema: str | None = None,
) -> None:
    if not isinstance(data, Mapping):
        return
    version = data.get("formatVersion")
    if version is None:
        report.warning(path, "missing formatVersion; treating as legacy")
    elif not isinstance(version, int):
        report.error(f"{path}/formatVersion", "must be an integer")
    elif version > MUSELAB_FORMAT_VERSION:
        report.warning(
            f"{path}/formatVersion",
            f"{version} is newer than this validator supports ({MUSELAB_FORMAT_VERSION})",
        )
    elif version < MUSELAB_FORMAT_VERSION:
        report.warning(
            f"{path}/formatVersion",
            f"{version} is older than current format ({MUSELAB_FORMAT_VERSION})",
        )

    schema_ref = data.get("schema") or data.get("$schema")
    if expected_schema and isinstance(schema_ref, str) and schema_ref != expected_schema:
        report.warning(path, f"unexpected schema reference: {schema_ref}")


def locale_tags(project: Mapping[str, Any]) -> list[str]:
    locales = project.get("locales")
    if not isinstance(locales, list):
        return []
    tags: list[str] = []
    for entry in locales:
        if isinstance(entry, str):
            tags.append(entry)
        elif isinstance(entry, Mapping) and isinstance(entry.get("locale"), str):
            tags.append(entry["locale"])
    return tags


def as_mapping(value: Any) -> Mapping[str, Any] | None:
    return value if isinstance(value, Mapping) else None


def as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def asset_index(project: Mapping[str, Any]) -> dict[str, Mapping[str, Any]]:
    index: dict[str, Mapping[str, Any]] = {}
    for asset in as_list(project.get("assets")):
        if isinstance(asset, Mapping) and isinstance(asset.get("id"), str):
            index[asset["id"]] = asset
    return index


def check_unique_ids(
    items: Sequence[Any],
    path: str,
    report: Report,
    *,
    id_key: str = "id",
) -> set[str]:
    seen: dict[str, int] = {}
    ids: set[str] = set()
    for i, item in enumerate(items):
        if not isinstance(item, Mapping):
            continue
        item_id = item.get(id_key)
        if not isinstance(item_id, str):
            continue
        ids.add(item_id)
        if item_id in seen:
            report.error(
                f"{path}/{i}/{id_key}",
                f"duplicate id '{item_id}' (also at {path}/{seen[item_id]}/{id_key})",
            )
        else:
            seen[item_id] = i
    return ids


def check_reachability(
    nodes: Sequence[Mapping[str, Any]],
    edges: Sequence[Mapping[str, Any]],
    entry_id: str,
    story_path: str,
    report: Report,
) -> None:
    node_ids = {n["id"] for n in nodes if isinstance(n.get("id"), str)}
    if entry_id not in node_ids:
        return
    adjacency: dict[str, list[str]] = defaultdict(list)
    for edge in edges:
        src = edge.get("sourceNodeId")
        dst = edge.get("targetNodeId")
        if isinstance(src, str) and isinstance(dst, str):
            adjacency[src].append(dst)

    seen: set[str] = set()
    stack = [entry_id]
    while stack:
        current = stack.pop()
        if current in seen:
            continue
        seen.add(current)
        stack.extend(adjacency.get(current, []))

    unreachable = sorted(node_ids - seen)
    for node_id in unreachable:
        report.error(
            f"{story_path}/nodes",
            f"node '{node_id}' is unreachable from entryNodeId '{entry_id}'",
        )


def semantic_validate_project(
    project: Mapping[str, Any],
    project_path: str,
    report: Report,
) -> None:
    assets = as_list(project.get("assets"))
    stories = as_list(project.get("stories"))
    locales = as_list(project.get("locales"))

    check_unique_ids(assets, f"{project_path}/assets", report)
    story_ids = check_unique_ids(stories, f"{project_path}/stories", report)
    check_unique_ids(locales, f"{project_path}/locales", report)

    tags = locale_tags(project)
    if not tags:
        report.error(f"{project_path}/locales", "must declare at least one locale")
    else:
        for i, tag in enumerate(tags):
            if not LOCALE_TAG_RE.match(tag):
                report.error(
                    f"{project_path}/locales/{i}",
                    f"invalid locale tag '{tag}' (expected lowercase letters/hyphens)",
                )
        if len(tags) != len(set(tags)):
            report.error(f"{project_path}/locales", "duplicate locale tags")

    default_locale = project.get("defaultLocale")
    if isinstance(default_locale, str) and tags and default_locale not in tags:
        report.error(
            f"{project_path}/defaultLocale",
            f"'{default_locale}' is not listed in locales ({', '.join(tags)})",
        )

    assets_by_id = asset_index(project)
    for i, asset in enumerate(assets):
        if not isinstance(asset, Mapping):
            continue
        asset_path = f"{project_path}/assets/{i}"
        asset_id = asset.get("id")
        asset_type = asset.get("type")
        if asset_type == "actor":
            expressions = as_list(asset.get("expressions"))
            if not expressions:
                report.error(f"{asset_path}/expressions", "actor assets require at least one expression")
            expr_ids = check_unique_ids(expressions, f"{asset_path}/expressions", report)
            default_expr = asset.get("defaultExpressionId")
            if isinstance(default_expr, str) and default_expr not in expr_ids:
                report.error(
                    f"{asset_path}/defaultExpressionId",
                    f"unknown expression id '{default_expr}'",
                )

    for si, story in enumerate(stories):
        if not isinstance(story, Mapping):
            continue
        story_path = f"{project_path}/stories/{si}"
        story_id = story.get("id")
        story_label = story_id if isinstance(story_id, str) else str(si)
        nodes = [n for n in as_list(story.get("nodes")) if isinstance(n, Mapping)]
        edges = [e for e in as_list(story.get("edges")) if isinstance(e, Mapping)]

        node_ids = check_unique_ids(nodes, f"{story_path}/nodes", report)
        check_unique_ids(edges, f"{story_path}/edges", report)

        labels: dict[str, str] = {}
        start_ids: list[str] = []
        for ni, node in enumerate(nodes):
            node_path = f"{story_path}/nodes/{ni}"
            node_id = node.get("id")
            node_type = node.get("type", "scene")
            label = node.get("label")
            if isinstance(label, str) and label:
                if label in labels:
                    report.error(
                        f"{node_path}/label",
                        f"duplicate node label '{label}' (also on node '{labels[label]}')",
                    )
                elif isinstance(node_id, str):
                    labels[label] = node_id

            if node_type == "start" and isinstance(node_id, str):
                start_ids.append(node_id)

            if node_type == "scene":
                backdrop_id = node.get("backdropId")
                if isinstance(backdrop_id, str):
                    if backdrop_id not in RESERVED_ASSET_IDS and backdrop_id not in assets_by_id:
                        report.error(
                            f"{node_path}/backdropId",
                            f"unknown asset id '{backdrop_id}'",
                        )
                    elif backdrop_id in assets_by_id and assets_by_id[backdrop_id].get("type") not in (
                        None,
                        "backdrop",
                    ):
                        report.error(
                            f"{node_path}/backdropId",
                            f"asset '{backdrop_id}' is type '{assets_by_id[backdrop_id].get('type')}', expected backdrop",
                        )

                for ai, actor_cfg in enumerate(as_list(node.get("actorConfigs"))):
                    if not isinstance(actor_cfg, Mapping):
                        continue
                    cfg_path = f"{node_path}/actorConfigs/{ai}"
                    actor_id = actor_cfg.get("assetId")
                    expr_id = actor_cfg.get("expressionId")
                    if not isinstance(actor_id, str):
                        continue
                    actor = assets_by_id.get(actor_id)
                    if actor is None:
                        report.error(f"{cfg_path}/assetId", f"unknown asset id '{actor_id}'")
                        continue
                    if actor.get("type") != "actor":
                        report.error(
                            f"{cfg_path}/assetId",
                            f"asset '{actor_id}' is type '{actor.get('type')}', expected actor",
                        )
                        continue
                    expr_ids = {
                        e.get("id")
                        for e in as_list(actor.get("expressions"))
                        if isinstance(e, Mapping)
                    }
                    if isinstance(expr_id, str) and expr_id not in expr_ids:
                        report.error(
                            f"{cfg_path}/expressionId",
                            f"expression '{expr_id}' not found on actor '{actor_id}'",
                        )

                # Legacy field from older generator docs
                if "actorIds" in node:
                    report.warning(
                        f"{node_path}/actorIds",
                        "legacy field; use actorConfigs[{assetId, expressionId}] instead",
                    )

                for sci, sound_cfg in enumerate(as_list(node.get("soundConfigs"))):
                    if not isinstance(sound_cfg, Mapping):
                        continue
                    sound_id = sound_cfg.get("assetId")
                    if not isinstance(sound_id, str):
                        continue
                    sound = assets_by_id.get(sound_id)
                    if sound is None:
                        report.error(
                            f"{node_path}/soundConfigs/{sci}/assetId",
                            f"unknown asset id '{sound_id}'",
                        )
                    elif sound.get("type") != "sound":
                        report.error(
                            f"{node_path}/soundConfigs/{sci}/assetId",
                            f"asset '{sound_id}' is type '{sound.get('type')}', expected sound",
                        )

            if node_type == "jump":
                target_story = node.get("jumpTargetStoryId")
                target_start = node.get("jumpTargetStartNodeId")
                if isinstance(target_story, str) and target_story not in story_ids:
                    report.error(
                        f"{node_path}/jumpTargetStoryId",
                        f"unknown story id '{target_story}'",
                    )

        if not nodes:
            report.error(f"{story_path}/nodes", f"story '{story_label}' has no nodes")
        elif not start_ids:
            report.error(
                f"{story_path}/nodes",
                f"story '{story_label}' needs at least one node with type 'start'",
            )

        entry_id = story.get("entryNodeId")
        if not isinstance(entry_id, str) or not entry_id:
            report.error(
                f"{story_path}/entryNodeId",
                f"story '{story_label}' must set entryNodeId to a start node id",
            )
        elif entry_id not in node_ids:
            report.error(
                f"{story_path}/entryNodeId",
                f"entryNodeId '{entry_id}' does not match any node in story '{story_label}'",
            )
        elif entry_id not in start_ids:
            report.error(
                f"{story_path}/entryNodeId",
                f"entryNodeId '{entry_id}' must reference a node with type 'start'",
            )
        else:
            check_reachability(nodes, edges, entry_id, story_path, report)

        for ei, edge in enumerate(edges):
            edge_path = f"{story_path}/edges/{ei}"
            edge_id = edge.get("id")
            source = edge.get("sourceNodeId")
            target = edge.get("targetNodeId")
            if isinstance(source, str) and source not in node_ids:
                report.error(f"{edge_path}/sourceNodeId", f"unknown node id '{source}'")
            if isinstance(target, str) and target not in node_ids:
                report.error(f"{edge_path}/targetNodeId", f"unknown node id '{target}'")

            source_port = edge.get("sourcePortId")
            if isinstance(edge_id, str) and isinstance(source_port, str):
                expected = f"out-{edge_id}"
                if source_port not in (expected, "__free_out__"):
                    report.error(
                        f"{edge_path}/sourcePortId",
                        f"expected '{expected}' or '__free_out__', got '{source_port}'",
                    )
            target_port = edge.get("targetPortId")
            if isinstance(target_port, str) and target_port != "__free_in__":
                report.error(
                    f"{edge_path}/targetPortId",
                    f"expected '__free_in__', got '{target_port}'",
                )


def semantic_validate_prompts(
    prompts: Mapping[str, Any],
    prompts_path: str,
    project: Mapping[str, Any],
    report: Report,
) -> None:
    stories = as_list(project.get("stories"))
    story_map = {
        s["id"]: s
        for s in stories
        if isinstance(s, Mapping) and isinstance(s.get("id"), str)
    }
    prompt_stories = as_mapping(prompts.get("stories")) or {}

    for story_id, story in story_map.items():
        entry = as_mapping(prompt_stories.get(story_id))
        if entry is None:
            report.error(
                f"{prompts_path}/stories",
                f"missing prompts for story '{story_id}'",
            )
            continue

        nodes = as_mapping(entry.get("nodes")) or {}
        edges = as_mapping(entry.get("edges")) or {}
        story_nodes = [n for n in as_list(story.get("nodes")) if isinstance(n, Mapping)]
        story_edges = [e for e in as_list(story.get("edges")) if isinstance(e, Mapping)]

        for node in story_nodes:
            node_id = node.get("id")
            node_type = node.get("type", "scene")
            if not isinstance(node_id, str):
                continue
            # Dialogue belongs on scene nodes; start/jump may omit prompts.
            if node_type != "scene":
                continue
            node_prompts = as_mapping(nodes.get(node_id))
            if node_prompts is None:
                report.error(
                    f"{prompts_path}/stories/{story_id}/nodes",
                    f"missing textTemplate entry for scene '{node_id}'",
                )
            elif "textTemplate" not in node_prompts:
                report.error(
                    f"{prompts_path}/stories/{story_id}/nodes/{node_id}",
                    "missing textTemplate (use empty string if intentional)",
                )

        for edge in story_edges:
            edge_id = edge.get("id")
            if isinstance(edge_id, str) and edge_id in edges and not isinstance(edges[edge_id], Mapping):
                report.error(
                    f"{prompts_path}/stories/{story_id}/edges/{edge_id}",
                    "edge prompt entry must be an object",
                )

        for node_id in nodes:
            if node_id not in {n.get("id") for n in story_nodes}:
                report.warning(
                    f"{prompts_path}/stories/{story_id}/nodes/{node_id}",
                    "prompts refer to unknown node id",
                )
        for edge_id in edges:
            if edge_id not in {e.get("id") for e in story_edges}:
                report.warning(
                    f"{prompts_path}/stories/{story_id}/edges/{edge_id}",
                    "prompts refer to unknown edge id",
                )

    for story_id in prompt_stories:
        if story_id not in story_map:
            report.warning(
                f"{prompts_path}/stories/{story_id}",
                "prompts refer to unknown story id",
            )


def validate_prompts_map(
    prompts_by_locale: Mapping[str, Any],
    base_path: str,
    project: Mapping[str, Any],
    report: Report,
    registry: Registry,
) -> None:
    tags = set(locale_tags(project))
    for locale, prompts in prompts_by_locale.items():
        path = f"{base_path}/{locale}"
        if tags and locale not in tags:
            report.error(path, f"locale '{locale}' is not listed in project.locales")
        if not isinstance(prompts, Mapping):
            report.error(path, "prompts value must be an object")
            continue
        format_version_checks(prompts, path, report, expected_schema=PROMPTS_SCHEMA_ID)
        validate_against_schema(prompts, PROMPTS_SCHEMA_ID, path, report, registry)
        semantic_validate_prompts(prompts, path, project, report)

    for tag in sorted(tags):
        if tag not in prompts_by_locale:
            report.error(base_path, f"missing prompts for locale '{tag}'")


def validate_archive_assets(
    project: Mapping[str, Any],
    archive_names: set[str],
    report: Report,
) -> None:
    for i, asset in enumerate(as_list(project.get("assets"))):
        if not isinstance(asset, Mapping):
            continue
        asset_id = asset.get("id")
        asset_type = asset.get("type")
        path = asset.get("path")
        if isinstance(path, str):
            if not path.startswith("assets/") or ".." in path:
                report.error(
                    f"project.json/assets/{i}/path",
                    f"archive-relative path must start with assets/ and not contain '..' (got '{path}')",
                )
            elif path not in archive_names:
                report.error(
                    f"project.json/assets/{i}/path",
                    f"referenced media '{path}' is missing from the archive",
                )
        elif (
            isinstance(asset_id, str)
            and asset_id not in RESERVED_ASSET_IDS
            and asset_type in {"backdrop", "sound", "font"}
            and not asset.get("imageData")
        ):
            report.warning(
                f"project.json/assets/{i}",
                f"asset '{asset_id}' has no path/imageData; media may be missing",
            )

        if asset_type == "actor":
            for ei, expression in enumerate(as_list(asset.get("expressions"))):
                if not isinstance(expression, Mapping):
                    continue
                expr_path = expression.get("path")
                if isinstance(expr_path, str):
                    if not expr_path.startswith("assets/") or ".." in expr_path:
                        report.error(
                            f"project.json/assets/{i}/expressions/{ei}/path",
                            f"invalid archive-relative path '{expr_path}'",
                        )
                    elif expr_path not in archive_names:
                        report.error(
                            f"project.json/assets/{i}/expressions/{ei}/path",
                            f"referenced media '{expr_path}' is missing from the archive",
                        )
                elif not expression.get("imageData") and not expression.get("url"):
                    report.warning(
                        f"project.json/assets/{i}/expressions/{ei}",
                        "expression has no path/imageData/url; sprite may be missing",
                    )


def validate_mlvn_archive(path: Path, report: Report, registry: Registry) -> None:
    try:
        with zipfile.ZipFile(path) as zf:
            names = set(zf.namelist())
            if "project.json" not in names:
                report.error(str(path), "archive is missing project.json")
                return

            metadata: Mapping[str, Any] | None = None
            if "muselab.json" in names:
                metadata = load_json_bytes(zf.read("muselab.json"), "muselab.json", report)
                if isinstance(metadata, Mapping):
                    format_version_checks(
                        metadata, "muselab.json", report, expected_schema=MLVN_SCHEMA_ID
                    )
                    validate_against_schema(
                        metadata, MLVN_SCHEMA_ID, "muselab.json", report, registry
                    )
            else:
                report.warning(
                    str(path),
                    "missing muselab.json archive metadata; treating as legacy archive",
                )

            project = load_json_bytes(zf.read("project.json"), "project.json", report)
            if not isinstance(project, Mapping):
                if project is not None:
                    report.error("project.json", "manifest root must be an object")
                return

            format_version_checks(
                project, "project.json", report, expected_schema=STORY_SCHEMA_ID
            )
            validate_against_schema(
                project, STORY_SCHEMA_ID, "project.json", report, registry
            )
            semantic_validate_project(project, "project.json", report)
            validate_archive_assets(project, names, report)

            prompts_by_locale: dict[str, Any] = {}
            for name in sorted(names):
                match = PROMPTS_FILE_RE.match(name)
                if not match:
                    continue
                locale = match.group(1)
                data = load_json_bytes(zf.read(name), name, report)
                if data is not None:
                    prompts_by_locale[locale] = data

            validate_prompts_map(
                prompts_by_locale, "prompts", project, report, registry
            )

            if isinstance(metadata, Mapping):
                manifest = metadata.get("manifest")
                if isinstance(manifest, str) and manifest != "project.json":
                    report.error("muselab.json/manifest", f"expected 'project.json', got '{manifest}'")
    except zipfile.BadZipFile:
        report.error(str(path), "file is not a valid zip/.mlvn archive")
    except OSError as exc:
        report.error(str(path), f"cannot read archive ({exc})")


def validate_bundle_json(data: Mapping[str, Any], path: str, report: Report, registry: Registry) -> None:
    format_version_checks(data, path, report, expected_schema=BUNDLE_SCHEMA_ID)
    validate_against_schema(data, BUNDLE_SCHEMA_ID, path, report, registry)

    project = as_mapping(data.get("project"))
    if project is None:
        report.error(f"{path}/project", "missing project object")
        return
    semantic_validate_project(project, f"{path}/project", report)

    prompts_by_locale = as_mapping(data.get("promptsByLocale"))
    if prompts_by_locale is None:
        report.error(f"{path}/promptsByLocale", "missing promptsByLocale object")
        return
    validate_prompts_map(
        prompts_by_locale, f"{path}/promptsByLocale", project, report, registry
    )


def validate_project_json(
    data: Mapping[str, Any],
    path: str,
    report: Report,
    registry: Registry,
    prompts_by_locale: Mapping[str, Any] | None = None,
) -> None:
    format_version_checks(data, path, report, expected_schema=STORY_SCHEMA_ID)
    validate_against_schema(data, STORY_SCHEMA_ID, path, report, registry)
    semantic_validate_project(data, path, report)
    if prompts_by_locale is not None:
        validate_prompts_map(prompts_by_locale, "promptsByLocale", data, report, registry)
    else:
        report.warning(
            path,
            "validated manifest only; pass a bundle JSON or --prompts DIR to check locale text",
        )


def detect_and_validate(
    path: Path,
    report: Report,
    registry: Registry,
    *,
    prompts_dir: Path | None = None,
) -> None:
    suffix = path.suffix.lower()
    if suffix == ".mlvn" or zipfile.is_zipfile(path):
        validate_mlvn_archive(path, report, registry)
        return

    data = load_json_path(path, report)
    if not isinstance(data, Mapping):
        if data is not None:
            report.error(str(path), "JSON root must be an object")
        return

    if "promptsByLocale" in data and "project" in data:
        validate_bundle_json(data, str(path), report, registry)
        return

    prompts_by_locale = None
    if prompts_dir is not None:
        prompts_by_locale = {}
        if not prompts_dir.is_dir():
            report.error(str(prompts_dir), "prompts directory does not exist")
        else:
            for prompts_path in sorted(prompts_dir.glob("prompts.*.json")):
                match = PROMPTS_FILE_RE.match(prompts_path.name)
                if not match:
                    continue
                loaded = load_json_path(prompts_path, report)
                if loaded is not None:
                    prompts_by_locale[match.group(1)] = loaded

    validate_project_json(data, str(path), report, registry, prompts_by_locale)


def print_report(report: Report, path: Path) -> None:
    errors = report.errors
    warnings = report.warnings
    print(f"Validating: {path}")
    if not report.issues:
        print("OK: no schema or semantic issues found.")
        return

    for issue in report.issues:
        print(issue.format())

    print()
    print(f"Summary: {len(errors)} error(s), {len(warnings)} warning(s)")
    if errors:
        print("INVALID — fix the errors above and re-run.")
    else:
        print("VALID with warnings.")


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate a MuseLab .mlvn archive or project/bundle JSON.",
        epilog=(
            "For AI agents authoring games, prefer bundle JSON validated against "
            "apps/designer/muselab.bundle.schema.json, then pack into .mlvn. "
            "See docs/prompts/generate-visual-novel-story.md (may lag the schemas)."
        ),
    )
    parser.add_argument(
        "path",
        type=Path,
        help="Path to a .mlvn archive, bundle JSON, or project.json",
    )
    parser.add_argument(
        "--prompts",
        type=Path,
        help="Directory containing prompts.<locale>.json (when validating standalone project.json)",
    )
    parser.add_argument(
        "--strict-warnings",
        action="store_true",
        help="Treat warnings as failures (exit code 1)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit machine-readable JSON report on stdout",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    path: Path = args.path
    if not path.exists():
        print(f"File not found: {path}", file=sys.stderr)
        return 2

    report = Report()
    try:
        registry = build_registry()
    except (OSError, json.JSONDecodeError, FileNotFoundError) as exc:
        print(f"Failed to load schemas from {SCHEMA_DIR}: {exc}", file=sys.stderr)
        return 2

    detect_and_validate(path, report, registry, prompts_dir=args.prompts)

    if args.json:
        payload = {
            "path": str(path),
            "ok": report.ok(strict_warnings=args.strict_warnings),
            "errors": [{"path": i.path, "message": i.message} for i in report.errors],
            "warnings": [{"path": i.path, "message": i.message} for i in report.warnings],
        }
        print(json.dumps(payload, indent=2))
    else:
        print_report(report, path)

    return 0 if report.ok(strict_warnings=args.strict_warnings) else 1


if __name__ == "__main__":
    sys.exit(main())
