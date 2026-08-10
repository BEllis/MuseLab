using MuseLab.Playback;
using MuseLab.Scene;

namespace MuseLab.Bridge
{
    public class UnityMuseLabBackground : IMuseLabBackground
    {
        readonly PromptInstructionRecorder recorder;

        public UnityMuseLabBackground(PromptInstructionRecorder recorder)
        {
            this.recorder = recorder;
        }

        public override void Show(string assetId) =>
            recorder.Scene(new SceneOp { Kind = SceneOpKind.BgShow, AssetId = assetId });

        public override void Clear() =>
            recorder.Scene(new SceneOp { Kind = SceneOpKind.BgClear });

        public override void Fade(string assetId, int durationMs) =>
            recorder.Scene(new SceneOp
            {
                Kind = SceneOpKind.BgFade,
                AssetId = assetId,
                DurationMs = durationMs,
            });

        public override void SlideIn(string assetId, string direction, int durationMs) =>
            recorder.Scene(new SceneOp
            {
                Kind = SceneOpKind.BgSlideIn,
                AssetId = assetId,
                Direction = direction,
                DurationMs = durationMs,
            });

        public override void SlideOut(string direction, int durationMs) =>
            recorder.Scene(new SceneOp
            {
                Kind = SceneOpKind.BgSlideOut,
                Direction = direction,
                DurationMs = durationMs,
            });
    }
}
