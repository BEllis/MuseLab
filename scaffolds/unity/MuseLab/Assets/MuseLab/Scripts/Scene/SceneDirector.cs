using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace MuseLab.Scene
{
    public class ScenePropState
    {
        public string Id;
        public string AssetId;
        public string VariationId;
        public string AssetKey;
        public StagePosition Position;
        public double X;
        public double Y;
        public bool Visible;
        public float Opacity = 1f;
        public int ZIndex = 100;
        public float Scale = 1f;
    }

    public class SceneBackgroundState
    {
        public string AssetId;
        public string AssetKey;
        public float Opacity = 1f;
        public double OffsetX;
        public double OffsetY;
    }

    public class SceneSnapshot
    {
        public SceneBackgroundState Background;
        public SceneBackgroundState OutgoingBackground;
        public List<ScenePropState> Props = new();
        public Dictionary<string, bool> DialogueChannels = new();
        public List<string> LoadedAssetKeys = new();
    }

    public class SceneActionException : Exception
    {
        public SceneActionException(string message) : base(message) { }
    }

    /// <summary>
    /// Authoritative Unity scene state. Visual actions resolve here rather than
    /// poking renderer objects directly.
    /// </summary>
    public class SceneDirector
    {
        public const int DefaultPropZ = 100;
        public const string DefaultDialogueChannel = "main";

        readonly Dictionary<string, ScenePropState> props = new();
        readonly Dictionary<string, bool> dialogueChannels = new();
        readonly AssetReferenceCounter assets;
        readonly MonoBehaviour host;
        readonly bool skipTransitions;

        SceneBackgroundState background;
        SceneBackgroundState outgoing;

        public event Action Changed;

        public SceneDirector(
            MonoBehaviour host,
            bool skipTransitions = false,
            Action<string> onLoadAsset = null,
            Action<string> onUnloadAsset = null)
        {
            this.host = host;
            this.skipTransitions = skipTransitions;
            assets = new AssetReferenceCounter(onLoadAsset, onUnloadAsset);
        }

        public SceneSnapshot GetSnapshot()
        {
            var snapshot = new SceneSnapshot
            {
                Background = CloneBackground(background),
                OutgoingBackground = CloneBackground(outgoing),
                LoadedAssetKeys = assets.LoadedKeys(),
            };
            foreach (var prop in props.Values)
                snapshot.Props.Add(CloneProp(prop));
            snapshot.Props.Sort((a, b) =>
            {
                var z = a.ZIndex.CompareTo(b.ZIndex);
                return z != 0 ? z : string.CompareOrdinal(a.Id, b.Id);
            });
            foreach (var entry in dialogueChannels)
                snapshot.DialogueChannels[entry.Key] = entry.Value;
            return snapshot;
        }

        public IEnumerator ApplyOp(SceneOp op)
        {
            switch (op.Kind)
            {
                case SceneOpKind.BgShow:
                {
                    var previous = background;
                    background = MakeBackground(op.AssetId, 1f, 0, 0);
                    ReleaseBackground(previous);
                    Notify();
                    yield break;
                }
                case SceneOpKind.BgClear:
                    ReleaseBackground(background);
                    ReleaseBackground(outgoing);
                    background = null;
                    outgoing = null;
                    Notify();
                    yield break;
                case SceneOpKind.BgFade:
                {
                    BeginBackgroundTransition(op.AssetId, 0, 0, 0f);
                    var incoming = background;
                    var outgoingBg = outgoing;
                    Notify();
                    yield return Tween(op.DurationMs, progress =>
                    {
                        if (incoming != null) incoming.Opacity = progress;
                        if (outgoingBg != null) outgoingBg.Opacity = 1f - progress;
                    });
                    FinishBackgroundTransition();
                    yield break;
                }
                case SceneOpKind.BgSlideIn:
                {
                    var offset = SlideOffset(op.Direction);
                    BeginBackgroundTransition(op.AssetId, offset.x, offset.y, 1f);
                    var incoming = background;
                    Notify();
                    yield return Tween(op.DurationMs, progress =>
                    {
                        if (incoming == null) return;
                        incoming.OffsetX = SceneTransitions.Lerp((float)offset.x, 0f, progress);
                        incoming.OffsetY = SceneTransitions.Lerp((float)offset.y, 0f, progress);
                    });
                    FinishBackgroundTransition();
                    yield break;
                }
                case SceneOpKind.BgSlideOut:
                {
                    var current = background;
                    if (current == null) yield break;
                    var offset = SlideOffset(op.Direction);
                    yield return Tween(op.DurationMs, progress =>
                    {
                        current.OffsetX = SceneTransitions.Lerp(0f, (float)-offset.x, progress);
                        current.OffsetY = SceneTransitions.Lerp(0f, (float)-offset.y, progress);
                    });
                    ReleaseBackground(current);
                    if (ReferenceEquals(background, current)) background = null;
                    Notify();
                    yield break;
                }
                case SceneOpKind.PropAdd:
                {
                    if (props.ContainsKey(op.Id))
                        throw new SceneActionException(
                            $"Cannot add prop '{op.Id}': a prop with this ID already exists in the scene.");
                    var assetKey = AssetReferenceCounter.Key(op.AssetId, op.VariationId);
                    assets.Acquire(assetKey);
                    var position = StagePosition.FromSlot("Centre");
                    var coords = StageCoords.Resolve(position);
                    props[op.Id] = new ScenePropState
                    {
                        Id = op.Id,
                        AssetId = op.AssetId,
                        VariationId = op.VariationId,
                        AssetKey = assetKey,
                        Position = position,
                        X = coords.x,
                        Y = coords.y,
                        Visible = false,
                        Opacity = 1f,
                        ZIndex = DefaultPropZ,
                        Scale = 1f,
                    };
                    Notify();
                    yield break;
                }
                case SceneOpKind.PropRemove:
                {
                    var prop = RequireProp(op.Id, "remove");
                    assets.Release(prop.AssetKey);
                    props.Remove(op.Id);
                    Notify();
                    yield break;
                }
                case SceneOpKind.PropShow:
                {
                    var prop = RequireProp(op.Id, "show");
                    if (op.HasPosition) SetPropPosition(prop, op.Position);
                    prop.Visible = true;
                    prop.Opacity = 1f;
                    Notify();
                    yield break;
                }
                case SceneOpKind.PropHide:
                {
                    var prop = RequireProp(op.Id, "hide");
                    prop.Visible = false;
                    Notify();
                    yield break;
                }
                case SceneOpKind.PropFadeIn:
                {
                    var prop = RequireProp(op.Id, "fade in");
                    if (op.HasPosition) SetPropPosition(prop, op.Position);
                    prop.Visible = true;
                    prop.Opacity = 0f;
                    Notify();
                    yield return Tween(op.DurationMs, progress => prop.Opacity = progress);
                    prop.Opacity = 1f;
                    Notify();
                    yield break;
                }
                case SceneOpKind.PropFadeOut:
                {
                    var prop = RequireProp(op.Id, "fade out");
                    var from = prop.Opacity;
                    yield return Tween(op.DurationMs, progress =>
                        prop.Opacity = SceneTransitions.Lerp(from, 0f, progress));
                    prop.Opacity = 0f;
                    prop.Visible = false;
                    Notify();
                    yield break;
                }
                case SceneOpKind.PropSlideIn:
                {
                    var prop = RequireProp(op.Id, "slide in");
                    var target = StageCoords.Resolve(op.Position);
                    var start = StageCoords.Offstage(target, op.Direction);
                    prop.Position = op.Position;
                    prop.X = start.x;
                    prop.Y = start.y;
                    prop.Visible = true;
                    prop.Opacity = 1f;
                    Notify();
                    yield return Tween(op.DurationMs, progress =>
                    {
                        prop.X = SceneTransitions.Lerp((float)start.x, (float)target.x, progress);
                        prop.Y = SceneTransitions.Lerp((float)start.y, (float)target.y, progress);
                    });
                    prop.X = target.x;
                    prop.Y = target.y;
                    Notify();
                    yield break;
                }
                case SceneOpKind.PropSlideOut:
                {
                    var prop = RequireProp(op.Id, "slide out");
                    var start = (prop.X, prop.Y);
                    var target = StageCoords.Offstage(start, op.Direction);
                    yield return Tween(op.DurationMs, progress =>
                    {
                        prop.X = SceneTransitions.Lerp((float)start.X, (float)target.x, progress);
                        prop.Y = SceneTransitions.Lerp((float)start.Y, (float)target.y, progress);
                    });
                    prop.Visible = false;
                    var restored = StageCoords.Resolve(prop.Position);
                    prop.X = restored.x;
                    prop.Y = restored.y;
                    Notify();
                    yield break;
                }
                case SceneOpKind.PropMove:
                {
                    var prop = RequireProp(op.Id, "move");
                    var start = (prop.X, prop.Y);
                    var target = StageCoords.Resolve(op.Position);
                    yield return Tween(op.DurationMs, progress =>
                    {
                        prop.X = SceneTransitions.Lerp((float)start.X, (float)target.x, progress);
                        prop.Y = SceneTransitions.Lerp((float)start.Y, (float)target.y, progress);
                    });
                    prop.Position = op.Position;
                    prop.X = target.x;
                    prop.Y = target.y;
                    Notify();
                    yield break;
                }
                case SceneOpKind.PropSetPosition:
                {
                    var prop = RequireProp(op.Id, "position");
                    SetPropPosition(prop, op.Position);
                    Notify();
                    yield break;
                }
                case SceneOpKind.PropSetZ:
                {
                    var prop = RequireProp(op.Id, "set the z layer of");
                    prop.ZIndex = op.Z;
                    Notify();
                    yield break;
                }
                case SceneOpKind.PropSetVariation:
                {
                    var prop = RequireProp(op.Id, "set the variation of");
                    var nextKey = AssetReferenceCounter.Key(prop.AssetId, op.VariationId);
                    if (nextKey == prop.AssetKey) yield break;
                    assets.Acquire(nextKey);
                    assets.Release(prop.AssetKey);
                    prop.AssetKey = nextKey;
                    prop.VariationId = op.VariationId;
                    Notify();
                    yield break;
                }
                case SceneOpKind.DialogueShow:
                    dialogueChannels[op.Channel ?? DefaultDialogueChannel] = true;
                    Notify();
                    yield break;
                case SceneOpKind.DialogueHide:
                    dialogueChannels[op.Channel ?? DefaultDialogueChannel] = false;
                    Notify();
                    yield break;
                default:
                    throw new SceneActionException($"Unsupported scene operation: {op.Kind}");
            }
        }

        public List<string> DialogueBoundary()
        {
            var removed = new List<string>();
            foreach (var entry in new List<KeyValuePair<string, ScenePropState>>(props))
            {
                if (entry.Value.Visible) continue;
                assets.Release(entry.Value.AssetKey);
                props.Remove(entry.Key);
                removed.Add(entry.Key);
            }
            if (removed.Count > 0) Notify();
            return removed;
        }

        public void Reset()
        {
            props.Clear();
            background = null;
            outgoing = null;
            dialogueChannels.Clear();
            assets.ReleaseAll();
            Notify();
        }

        IEnumerator Tween(int durationMs, Action<float> onUpdate)
        {
            var duration = skipTransitions ? 0 : durationMs;
            yield return SceneTransitions.RunTween(duration, progress =>
            {
                onUpdate(progress);
                Notify();
            });
        }

        ScenePropState RequireProp(string id, string verb)
        {
            if (!props.TryGetValue(id, out var prop))
                throw new SceneActionException(
                    $"Cannot {verb} prop '{id}': no active prop with this ID exists. Call Prop.Add(...) first.");
            return prop;
        }

        void SetPropPosition(ScenePropState prop, StagePosition position)
        {
            var coords = StageCoords.Resolve(position);
            prop.Position = position;
            prop.X = coords.x;
            prop.Y = coords.y;
        }

        SceneBackgroundState MakeBackground(string assetId, float opacity, double offsetX, double offsetY)
        {
            var assetKey = AssetReferenceCounter.Key(assetId);
            assets.Acquire(assetKey);
            return new SceneBackgroundState
            {
                AssetId = assetId,
                AssetKey = assetKey,
                Opacity = opacity,
                OffsetX = offsetX,
                OffsetY = offsetY,
            };
        }

        void ReleaseBackground(SceneBackgroundState state)
        {
            if (state != null) assets.Release(state.AssetKey);
        }

        void BeginBackgroundTransition(string assetId, double offsetX, double offsetY, float opacity)
        {
            outgoing = background;
            background = MakeBackground(assetId, opacity, offsetX, offsetY);
        }

        void FinishBackgroundTransition()
        {
            ReleaseBackground(outgoing);
            outgoing = null;
            if (background != null)
            {
                background.Opacity = 1f;
                background.OffsetX = 0;
                background.OffsetY = 0;
            }
            Notify();
        }

        (double x, double y) SlideOffset(string direction)
        {
            var from = StageCoords.Offstage((0, 0), direction);
            return (
                direction is "Top" or "Bottom" ? 0 : from.x > 0 ? StageCoords.Width : -StageCoords.Width,
                direction is "Left" or "Right" ? 0 : from.y > 0 ? StageCoords.Height : -StageCoords.Height
            );
        }

        void Notify() => Changed?.Invoke();

        static SceneBackgroundState CloneBackground(SceneBackgroundState source) =>
            source == null
                ? null
                : new SceneBackgroundState
                {
                    AssetId = source.AssetId,
                    AssetKey = source.AssetKey,
                    Opacity = source.Opacity,
                    OffsetX = source.OffsetX,
                    OffsetY = source.OffsetY,
                };

        static ScenePropState CloneProp(ScenePropState source) =>
            new()
            {
                Id = source.Id,
                AssetId = source.AssetId,
                VariationId = source.VariationId,
                AssetKey = source.AssetKey,
                Position = source.Position,
                X = source.X,
                Y = source.Y,
                Visible = source.Visible,
                Opacity = source.Opacity,
                ZIndex = source.ZIndex,
                Scale = source.Scale,
            };
    }
}
