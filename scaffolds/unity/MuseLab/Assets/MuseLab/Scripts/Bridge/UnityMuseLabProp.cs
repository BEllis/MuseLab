using MuseLab.Playback;
using MuseLab.Scene;

namespace MuseLab.Bridge
{
    public class UnityMuseLabProp : IMuseLabProp
    {
        readonly PromptInstructionRecorder recorder;

        public UnityMuseLabProp(PromptInstructionRecorder recorder)
        {
            this.recorder = recorder;
        }

        public override void Add(string id, string assetId) =>
            recorder.Scene(new SceneOp { Kind = SceneOpKind.PropAdd, Id = id, AssetId = assetId });

        public override void AddVariant(string id, string assetId, string variationId) =>
            recorder.Scene(new SceneOp
            {
                Kind = SceneOpKind.PropAdd,
                Id = id,
                AssetId = assetId,
                VariationId = variationId,
            });

        public override void Remove(string id) =>
            recorder.Scene(new SceneOp { Kind = SceneOpKind.PropRemove, Id = id });

        public override void Show(string id) =>
            recorder.Scene(new SceneOp { Kind = SceneOpKind.PropShow, Id = id });

        public override void ShowAt(string id, string slot) =>
            recorder.Scene(new SceneOp
            {
                Kind = SceneOpKind.PropShow,
                Id = id,
                HasPosition = true,
                Position = StagePosition.FromSlot(slot),
            });

        public override void ShowAtXY(string id, double x, double y) =>
            recorder.Scene(new SceneOp
            {
                Kind = SceneOpKind.PropShow,
                Id = id,
                HasPosition = true,
                Position = StagePosition.FromXY(x, y),
            });

        public override void Hide(string id) =>
            recorder.Scene(new SceneOp { Kind = SceneOpKind.PropHide, Id = id });

        public override void FadeIn(string id, int durationMs) =>
            recorder.Scene(new SceneOp
            {
                Kind = SceneOpKind.PropFadeIn,
                Id = id,
                DurationMs = durationMs,
            });

        public override void FadeInAt(string id, string slot, int durationMs) =>
            recorder.Scene(new SceneOp
            {
                Kind = SceneOpKind.PropFadeIn,
                Id = id,
                HasPosition = true,
                Position = StagePosition.FromSlot(slot),
                DurationMs = durationMs,
            });

        public override void FadeInAtXY(string id, double x, double y, int durationMs) =>
            recorder.Scene(new SceneOp
            {
                Kind = SceneOpKind.PropFadeIn,
                Id = id,
                HasPosition = true,
                Position = StagePosition.FromXY(x, y),
                DurationMs = durationMs,
            });

        public override void FadeOut(string id, int durationMs) =>
            recorder.Scene(new SceneOp
            {
                Kind = SceneOpKind.PropFadeOut,
                Id = id,
                DurationMs = durationMs,
            });

        public override void SlideIn(string id, string slot, string direction, int durationMs) =>
            recorder.Scene(new SceneOp
            {
                Kind = SceneOpKind.PropSlideIn,
                Id = id,
                HasPosition = true,
                Position = StagePosition.FromSlot(slot),
                Direction = direction,
                DurationMs = durationMs,
            });

        public override void SlideInXY(string id, double x, double y, string direction, int durationMs) =>
            recorder.Scene(new SceneOp
            {
                Kind = SceneOpKind.PropSlideIn,
                Id = id,
                HasPosition = true,
                Position = StagePosition.FromXY(x, y),
                Direction = direction,
                DurationMs = durationMs,
            });

        public override void SlideOut(string id, string direction, int durationMs) =>
            recorder.Scene(new SceneOp
            {
                Kind = SceneOpKind.PropSlideOut,
                Id = id,
                Direction = direction,
                DurationMs = durationMs,
            });

        public override void Move(string id, string slot, int durationMs) =>
            recorder.Scene(new SceneOp
            {
                Kind = SceneOpKind.PropMove,
                Id = id,
                HasPosition = true,
                Position = StagePosition.FromSlot(slot),
                DurationMs = durationMs,
            });

        public override void MoveXY(string id, double x, double y, int durationMs) =>
            recorder.Scene(new SceneOp
            {
                Kind = SceneOpKind.PropMove,
                Id = id,
                HasPosition = true,
                Position = StagePosition.FromXY(x, y),
                DurationMs = durationMs,
            });

        public override void SetPosition(string id, string slot) =>
            recorder.Scene(new SceneOp
            {
                Kind = SceneOpKind.PropSetPosition,
                Id = id,
                HasPosition = true,
                Position = StagePosition.FromSlot(slot),
            });

        public override void SetPositionXY(string id, double x, double y) =>
            recorder.Scene(new SceneOp
            {
                Kind = SceneOpKind.PropSetPosition,
                Id = id,
                HasPosition = true,
                Position = StagePosition.FromXY(x, y),
            });

        public override void SetZ(string id, int z) =>
            recorder.Scene(new SceneOp { Kind = SceneOpKind.PropSetZ, Id = id, Z = z });

        public override void SetVariation(string id, string variationId) =>
            recorder.Scene(new SceneOp
            {
                Kind = SceneOpKind.PropSetVariation,
                Id = id,
                VariationId = variationId,
            });
    }
}
