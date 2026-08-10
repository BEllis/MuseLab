using System;
using System.Collections.Generic;

namespace MuseLab.Scene
{
    public static class StageCoords
    {
        public const double Width = 16;
        public const double Height = 9;

        static readonly Dictionary<string, (double x, double y)> Slots = new()
        {
            ["TopLeft"] = (4, 7.5),
            ["Top"] = (8, 7.5),
            ["TopRight"] = (12, 7.5),
            ["FarLeft"] = (1.5, 4.5),
            ["Left"] = (4, 4.5),
            ["Centre"] = (8, 4.5),
            ["Right"] = (12, 4.5),
            ["FarRight"] = (14.5, 4.5),
            ["BottomLeft"] = (4, 1.5),
            ["Bottom"] = (8, 1.5),
            ["BottomRight"] = (12, 1.5),
        };

        static readonly Dictionary<string, (double x, double y)> Directions = new()
        {
            ["Left"] = (-1, 0),
            ["Right"] = (1, 0),
            ["Top"] = (0, 1),
            ["Bottom"] = (0, -1),
            ["TopLeft"] = (-1, 1),
            ["TopRight"] = (1, 1),
            ["BottomLeft"] = (-1, -1),
            ["BottomRight"] = (1, -1),
        };

        public static (double x, double y) Resolve(StagePosition position)
        {
            if (position.Kind == PositionKind.Vec) return (position.X, position.Y);
            if (Slots.TryGetValue(position.Slot ?? "", out var slot)) return slot;
            throw new InvalidOperationException(
                $"Unknown position \"{position.Slot}\". Use a named slot such as Left, Centre, or BottomRight.");
        }

        public static (double x, double y) DirectionVector(string direction)
        {
            if (Directions.TryGetValue(direction ?? "", out var vector)) return vector;
            throw new InvalidOperationException(
                $"Unknown direction \"{direction}\". Use Left, Right, Top, Bottom, or a corner.");
        }

        public static (double x, double y) Offstage((double x, double y) from, string direction)
        {
            var vector = DirectionVector(direction);
            const double margin = 0.75;
            return (
                vector.x == 0 ? from.x : vector.x < 0 ? -Width * margin : Width * (1 + margin),
                vector.y == 0 ? from.y : vector.y < 0 ? -Height * margin : Height * (1 + margin)
            );
        }
    }
}
