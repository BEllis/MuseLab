using System;
using System.Collections.Generic;
using MuseLab.Audio;
using MuseLab.Playback;

namespace MuseLab.Bridge
{
    public class UnityMuseLabRuntime : IMuseLabRuntime
    {
        readonly Dictionary<string, object> state = new();
        SoundManager soundManager;
        PromptInstructionRecorder instructionRecorder;

        public event Action<string> OnEmit;
        public event Func<string, string> OnCall;

        public void BindSoundManager(SoundManager manager) => soundManager = manager;

        public void BindInstructionRecorder(PromptInstructionRecorder recorder) => instructionRecorder = recorder;

        public void ReplaceState(Dictionary<string, object> newState)
        {
            state.Clear();
            if (newState == null) return;
            foreach (var pair in newState)
                state[pair.Key] = pair.Value;
        }

        public override string GetString(string key)
        {
            if (!state.TryGetValue(key, out var value) || value == null) return "";
            return Convert.ToString(value);
        }

        public override bool GetBool(string key)
        {
            if (!state.TryGetValue(key, out var value) || value == null) return false;
            return Convert.ToBoolean(value);
        }

        public override int GetInt(string key)
        {
            if (!state.TryGetValue(key, out var value) || value == null) return 0;
            if (value is int i) return i;
            if (value is long l) return (int)l;
            if (value is double d) return (int)d;
            if (int.TryParse(Convert.ToString(value), out var parsed)) return parsed;
            return 0;
        }

        public override bool HasKey(string key) => state.ContainsKey(key);

        public override void SetString(string key, string value) => state[key] = value ?? "";

        public override void SetBool(string key, bool value) => state[key] = value;

        public override void SetInt(string key, int value) => state[key] = value;

        public override void Emit(string eventName)
        {
            OnEmit?.Invoke(eventName);
            UnityEngine.Debug.Log($"MuseLab.Emit: {eventName}");
        }

        public override string Call(string name)
        {
            var result = OnCall?.Invoke(name);
            return result ?? "";
        }

        public override void PlaySound(string assetId)
        {
            if (soundManager == null) return;
            soundManager.PlayImmediate(assetId);
        }

        public override void PlaySoundTrim(string assetId, double startTime, double endTime)
        {
            if (soundManager == null) return;
            soundManager.PlayImmediate(assetId, startTime, endTime);
        }

        public override void PlaySoundClip(string assetId, double delaySeconds, double startTime, double endTime)
        {
            if (delaySeconds > 0)
            {
                if (instructionRecorder == null)
                    throw new InvalidOperationException("PlaySoundClip requires the default prompt instruction recorder");
                instructionRecorder.PlaySound(assetId, delaySeconds, startTime, endTime);
                return;
            }
            if (soundManager == null) return;
            soundManager.PlayImmediate(assetId, startTime, endTime);
        }

        public override void PlaySoundClipByPath(string groupPath, string assetName, double delaySeconds, double startTime, double endTime)
        {
            PlaySoundClip(assetName, delaySeconds, startTime, endTime);
        }
    }
}
