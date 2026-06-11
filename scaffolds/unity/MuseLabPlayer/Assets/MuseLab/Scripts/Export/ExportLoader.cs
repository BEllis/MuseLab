using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using UnityEngine;

namespace MuseLab.Export
{
    public class ExportContext
    {
        public string RootPath { get; set; }
        public ProjectManifest Manifest { get; set; }
        public string DefaultLocale { get; set; }
    }

    public class ExportLoadProgress
    {
        public string Label { get; set; }
        public float Fraction { get; set; }
    }

    public static class ExportLoader
    {
        const string ExportFolderName = "MuseLabExport";

        public static string GetExportRootPath()
        {
            return Path.Combine(Application.streamingAssetsPath, ExportFolderName);
        }

        public static async Task<ExportContext> LoadAsync(IProgress<ExportLoadProgress> progress = null)
        {
            var root = GetExportRootPath();
            Report(progress, "Validating export", 0.1f);
            await Task.Yield();

            if (!Directory.Exists(root))
                throw new InvalidOperationException($"Export folder not found: {root}");

            var projectPath = Path.Combine(root, "project.json");
            if (!File.Exists(projectPath))
                throw new InvalidOperationException($"Missing project.json in export: {root}");

            var muselabPath = Path.Combine(root, "muselab.json");
            if (!File.Exists(muselabPath))
                throw new InvalidOperationException($"Missing muselab.json in export: {root}");

            Report(progress, "Parsing project manifest", 0.35f);
            await Task.Yield();

            var json = await ReadTextAsync(projectPath);
            var manifest = JsonUtility.FromJson<ProjectManifest>(json);
            if (manifest == null || manifest.stories == null || manifest.stories.Length == 0)
                manifest = ProjectManifestParser.Parse(json);
            if (manifest == null || manifest.stories == null || manifest.stories.Length == 0)
                throw new InvalidOperationException("Failed to parse project.json");

            Report(progress, "Preloading assets", 0.65f);
            await Task.Yield();

            var backdropIds = new HashSet<string>();
            foreach (var story in manifest.stories)
            {
                foreach (var node in story.nodes)
                {
                    if (!string.IsNullOrEmpty(node.backdropId))
                        backdropIds.Add(node.backdropId);
                }
            }

            foreach (var assetId in backdropIds)
            {
                var archivePath = MuseLabProjectData.GetAssetArchivePath(assetId);
                var diskPath = ResolveArchivePath(root, archivePath);
                if (!File.Exists(diskPath))
                    Debug.LogWarning($"MuseLab export asset missing: {diskPath}");
            }

            Report(progress, "Ready", 1f);
            return new ExportContext
            {
                RootPath = root,
                Manifest = manifest,
                DefaultLocale = string.IsNullOrEmpty(manifest.defaultLocale) ? "en" : manifest.defaultLocale,
            };
        }

        public static string ResolveArchivePath(string exportRoot, string archiveRelativePath)
        {
            if (string.IsNullOrEmpty(archiveRelativePath))
                throw new ArgumentException("Archive path is required", nameof(archiveRelativePath));
            if (archiveRelativePath.Contains(".."))
                throw new InvalidOperationException($"Invalid archive path: {archiveRelativePath}");
            return Path.Combine(exportRoot, archiveRelativePath.Replace('/', Path.DirectorySeparatorChar));
        }

        static void Report(IProgress<ExportLoadProgress> progress, string label, float fraction)
        {
            progress?.Report(new ExportLoadProgress { Label = label, Fraction = fraction });
        }

        static async Task<string> ReadTextAsync(string path)
        {
            using var reader = new StreamReader(path);
            return await reader.ReadToEndAsync();
        }
    }
}
