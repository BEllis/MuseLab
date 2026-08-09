namespace MuseLab.UI.Dialogue
{
    public interface IDialogueTextView
    {
        void SetMarkup(string markup);
        bool HasMoreToPaginate { get; }
        bool Paginate();
        void OnRevealStarted();
        void OnRevealEnded();
        void SetShowContinueHint(bool show);
    }
}
