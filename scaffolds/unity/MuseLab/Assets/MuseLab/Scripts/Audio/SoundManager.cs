using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using MuseLab.Export;
using UnityEngine;
using UnityEngine.Networking;

namespace MuseLab.Audio
{
    public class SoundManager : MonoBehaviour
    {
        readonly Dictionary<string, AudioClip> clipCache = new();
        readonly Queue<AudioSource> sourcePool = new();
        string exportRoot;

        public void Initialize(string exportRootPath)
        {
            exportRoot = exportRootPath;
        }

        public void PlayImmediate(string assetId, double startTime = -1, double endTime = -1)
        {
            StartCoroutine(PlayRoutine(assetId, 0, startTime, endTime));
        }

        public void PlayDelayed(string assetId, double delaySeconds, double startTime = -1, double endTime = -1)
        {
            StartCoroutine(PlayRoutine(assetId, delaySeconds, startTime, endTime));
        }

        IEnumerator PlayRoutine(string assetId, double delaySeconds, double startTime, double endTime)
        {
            if (delaySeconds > 0)
                yield return new WaitForSeconds((float)delaySeconds);

            var clip = LoadClip(assetId);
            if (clip == null) yield break;

            var source = GetSource();
            source.clip = clip;
            source.loop = false;
            if (startTime >= 0)
                source.time = (float)startTime;
            source.Play();

            if (endTime >= 0 && endTime > startTime)
            {
                var duration = (float)(endTime - Math.Max(0, startTime));
                yield return new WaitForSeconds(duration);
                source.Stop();
            }
            else
            {
                yield return new WaitForSeconds(clip.length);
            }

            ReturnSource(source);
        }

        AudioSource GetSource()
        {
            if (sourcePool.Count > 0)
                return sourcePool.Dequeue();
            return gameObject.AddComponent<AudioSource>();
        }

        void ReturnSource(AudioSource source)
        {
            source.clip = null;
            sourcePool.Enqueue(source);
        }

        AudioClip LoadClip(string assetId)
        {
            if (clipCache.TryGetValue(assetId, out var cached))
                return cached;

            var archivePath = MuseLabProjectData.GetAssetArchivePath(assetId);
            var diskPath = ExportLoader.ResolveArchivePath(exportRoot, archivePath);
            if (!File.Exists(diskPath))
            {
                Debug.LogWarning($"Sound asset not found: {diskPath}");
                return null;
            }

            var bytes = File.ReadAllBytes(diskPath);
            var ext = Path.GetExtension(diskPath).ToLowerInvariant();
            var type = ext switch
            {
                ".wav" => AudioType.WAV,
                ".ogg" => AudioType.OGGVORBIS,
                ".mp3" => AudioType.MPEG,
                _ => AudioType.UNKNOWN,
            };

            var clip = LoadAudioFromBytes($"sound_{assetId}", bytes, type);
            if (clip != null) clipCache[assetId] = clip;
            return clip;
        }

        static AudioClip LoadAudioFromBytes(string name, byte[] bytes, AudioType type)
        {
            if (type == AudioType.UNKNOWN)
            {
                if (bytes.Length > 4 && bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F')
                    type = AudioType.WAV;
                else if (bytes.Length > 3 && bytes[0] == 'O' && bytes[1] == 'g' && bytes[2] == 'g')
                    type = AudioType.OGGVORBIS;
                else
                    type = AudioType.MPEG;
            }

            var tempPath = Path.Combine(Application.temporaryCachePath, $"{name}{ExtensionForAudioType(type)}");
            File.WriteAllBytes(tempPath, bytes);
            using var request = UnityWebRequestMultimedia.GetAudioClip("file://" + tempPath, type);
            var op = request.SendWebRequest();
            while (!op.isDone) { }
            if (request.result != UnityWebRequest.Result.Success)
            {
                Debug.LogWarning($"Failed to load audio {name}: {request.error}");
                return null;
            }
            var clip = DownloadHandlerAudioClip.GetContent(request);
            clip.name = name;
            return clip;
        }

        static string ExtensionForAudioType(AudioType type) => type switch
        {
            AudioType.WAV => ".wav",
            AudioType.OGGVORBIS => ".ogg",
            AudioType.MPEG => ".mp3",
            _ => ".bin",
        };
    }
}
