using System;

namespace MuseLab.Scene
{
    public enum SceneOpKind
    {
        BgShow,
        BgClear,
        BgFade,
        BgSlideIn,
        BgSlideOut,
        PropAdd,
        PropRemove,
        PropShow,
        PropHide,
        PropFadeIn,
        PropFadeOut,
        PropSlideIn,
        PropSlideOut,
        PropMove,
        PropSetPosition,
        PropSetZ,
        PropSetVariation,
        PropHighlight,
        PropUnhighlight,
        DialogueShow,
        DialogueHide,
        DialogueSetWidth,
    }

    public enum PositionKind
    {
        Slot,
        Vec,
    }

    [Serializable]
    public struct StagePosition
    {
        public PositionKind Kind;
        public string Slot;
        public double X;
        public double Y;

        public static StagePosition FromSlot(string slot) =>
            new() { Kind = PositionKind.Slot, Slot = slot };

        public static StagePosition FromXY(double x, double y) =>
            new() { Kind = PositionKind.Vec, X = x, Y = y };
    }

    [Serializable]
    public class SceneOp
    {
        public SceneOpKind Kind;
        public string AssetId;
        public string Id;
        public string VariationId;
        public string Direction;
        public string CharacterId;
        public int DurationMs;
        public int Z;
        public int WidthPercent;
        public StagePosition Position;
        public bool HasPosition;
    }
}
