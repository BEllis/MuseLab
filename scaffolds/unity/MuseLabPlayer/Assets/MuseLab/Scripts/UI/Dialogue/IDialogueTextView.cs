namespace MuseLab.UI.Dialogue
{
    public struct DialoguePlaybackGate
    {
        public int TotalVisualLines;
        public int MeasuredForHtmlLength;
    }

    public interface IDialogueTextView
    {
        void SetMarkup(string markup);
        int LineCount { get; }
        DialoguePlaybackGate PlaybackGate { get; }
        bool HasMoreToPaginate { get; }
        bool Paginate();
        void OnRevealStarted();
        void OnRevealEnded();
        void SetShowMoreHint(bool show);
        void SetShowContinueHint(bool show);
    }
}
