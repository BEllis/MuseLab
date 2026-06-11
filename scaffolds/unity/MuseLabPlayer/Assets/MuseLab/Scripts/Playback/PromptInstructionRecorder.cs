using System.Collections.Generic;

namespace MuseLab.Playback
{
    enum RevealBlockKind
    {
        None,
        Rate,
        OverTime,
    }

    class OverTimeItem
    {
        public enum ItemKind { Text, Sound, Wait, UpdateSpeaker }
        public ItemKind Kind;
        public string Html;
        public int PlainLength;
        public int WordCount;
        public int Milliseconds;
        public string AssetId;
        public double DelaySeconds;
        public double StartTime = -1;
        public double EndTime = -1;
        public string SpeakerTemplate;
    }

    class RevealBlockState
    {
        public RevealBlockKind Kind = RevealBlockKind.None;
        public RevealRateKind RateKind;
        public RevealOverTimeKind OverTimeKind;
        public double Rate;
        public int DurationMs;
        public List<OverTimeItem> Items = new();
    }

    public class PromptInstructionRecorder
    {
        readonly List<PromptInstruction> instructions = new();
        RevealBlockState block = new();

        public IReadOnlyList<PromptInstruction> Instructions => instructions;

        public void Clear()
        {
            instructions.Clear();
            block = new RevealBlockState();
        }

        public void AppendHtml(string html)
        {
            PushHtml(html, "");
        }

        public void AppendRevealText(string html, string plainText)
        {
            PushHtml(html, plainText);
        }

        void PushHtml(string html, string plainText)
        {
            if (string.IsNullOrEmpty(html)) return;
            if (block.Kind == RevealBlockKind.None)
            {
                instructions.Add(new PromptInstruction { Kind = PromptInstructionKind.AppendHtml, Html = html });
                return;
            }
            if (block.Kind == RevealBlockKind.Rate)
            {
                instructions.Add(new PromptInstruction
                {
                    Kind = PromptInstructionKind.RevealHtml,
                    Html = html,
                    PlainLength = plainText.Length,
                    WordCount = PromptInstructionRules.CountWords(plainText),
                    RateKind = block.RateKind,
                    Rate = block.Rate,
                });
                return;
            }
            AppendOverTimeText(html, plainText);
        }

        void AppendOverTimeText(string html, string plainText)
        {
            var last = block.Items.Count > 0 ? block.Items[block.Items.Count - 1] : null;
            if (last != null && last.Kind == OverTimeItem.ItemKind.Text)
            {
                last.Html += html;
                last.PlainLength += plainText.Length;
                last.WordCount += PromptInstructionRules.CountWords(plainText);
                return;
            }
            block.Items.Add(new OverTimeItem
            {
                Kind = OverTimeItem.ItemKind.Text,
                Html = html,
                PlainLength = plainText.Length,
                WordCount = PromptInstructionRules.CountWords(plainText),
            });
        }

        public void Wait(int milliseconds)
        {
            if (milliseconds <= 0) return;
            var ms = (int)milliseconds;
            if (block.Kind == RevealBlockKind.OverTime)
            {
                block.Items.Add(new OverTimeItem { Kind = OverTimeItem.ItemKind.Wait, Milliseconds = ms });
                return;
            }
            instructions.Add(new PromptInstruction { Kind = PromptInstructionKind.Wait, Milliseconds = ms });
        }

        public void WaitForContinue()
        {
            if (block.Kind == RevealBlockKind.OverTime)
            {
                FlushOverTimeItems();
                block = new RevealBlockState();
            }
            instructions.Add(new PromptInstruction { Kind = PromptInstructionKind.WaitForContinue });
        }

        public void RevealCharsBegin(double charsPerSecond)
        {
            if (block.Kind == RevealBlockKind.OverTime) FlushOverTimeItems();
            block = new RevealBlockState
            {
                Kind = RevealBlockKind.Rate,
                RateKind = RevealRateKind.CharsPerSecond,
                Rate = PromptInstructionRules.NormalizeRate(charsPerSecond, PromptInstructionRules.DefaultCharsPerSecond),
            };
        }

        public void RevealWordsBegin(double wordsPerSecond)
        {
            if (block.Kind == RevealBlockKind.OverTime) FlushOverTimeItems();
            block = new RevealBlockState
            {
                Kind = RevealBlockKind.Rate,
                RateKind = RevealRateKind.WordsPerSecond,
                Rate = PromptInstructionRules.NormalizeRate(wordsPerSecond, PromptInstructionRules.DefaultWordsPerSecond),
            };
        }

        public void RevealCharsOverTimeBegin(int durationMs)
        {
            if (block.Kind == RevealBlockKind.OverTime) FlushOverTimeItems();
            block = new RevealBlockState
            {
                Kind = RevealBlockKind.OverTime,
                OverTimeKind = RevealOverTimeKind.CharsOverTime,
                DurationMs = durationMs < 0 ? 0 : durationMs,
                Items = new List<OverTimeItem>(),
            };
        }

        public void RevealWordsOverTimeBegin(int durationMs)
        {
            if (block.Kind == RevealBlockKind.OverTime) FlushOverTimeItems();
            block = new RevealBlockState
            {
                Kind = RevealBlockKind.OverTime,
                OverTimeKind = RevealOverTimeKind.WordsOverTime,
                DurationMs = durationMs < 0 ? 0 : durationMs,
                Items = new List<OverTimeItem>(),
            };
        }

        public void RevealEnd()
        {
            if (block.Kind == RevealBlockKind.OverTime)
                FlushOverTimeItems();
            block = new RevealBlockState();
        }

        public void PlaySound(string assetId, double delaySeconds, double startTime, double endTime)
        {
            var item = new OverTimeItem
            {
                Kind = OverTimeItem.ItemKind.Sound,
                AssetId = assetId,
                DelaySeconds = delaySeconds < 0 ? 0 : delaySeconds,
                StartTime = startTime,
                EndTime = endTime,
            };
            if (block.Kind == RevealBlockKind.OverTime)
            {
                block.Items.Add(item);
                return;
            }
            instructions.Add(new PromptInstruction
            {
                Kind = PromptInstructionKind.PlaySound,
                AssetId = assetId,
                DelaySeconds = item.DelaySeconds,
                StartTime = startTime,
                EndTime = endTime,
            });
        }

        public void UpdateSpeaker(string template)
        {
            if (block.Kind == RevealBlockKind.OverTime)
            {
                block.Items.Add(new OverTimeItem { Kind = OverTimeItem.ItemKind.UpdateSpeaker, SpeakerTemplate = template });
                return;
            }
            instructions.Add(new PromptInstruction { Kind = PromptInstructionKind.UpdateSpeaker, SpeakerTemplate = template });
        }

        public void Reset()
        {
            if (block.Kind == RevealBlockKind.OverTime) FlushOverTimeItems();
            block = new RevealBlockState();
            instructions.Add(new PromptInstruction { Kind = PromptInstructionKind.Reset });
        }

        public void ClearInstruction()
        {
            if (block.Kind == RevealBlockKind.OverTime) FlushOverTimeItems();
            block = new RevealBlockState();
            instructions.Add(new PromptInstruction { Kind = PromptInstructionKind.Clear });
        }

        void FlushOverTimeItems()
        {
            if (block.Kind != RevealBlockKind.OverTime) return;
            var textItems = new List<OverTimeItem>();
            foreach (var item in block.Items)
                if (item.Kind == OverTimeItem.ItemKind.Text) textItems.Add(item);

            var totalPlain = 0;
            var totalWords = 0;
            foreach (var item in textItems)
            {
                totalPlain += item.PlainLength;
                totalWords += item.WordCount;
            }

            foreach (var item in block.Items)
            {
                switch (item.Kind)
                {
                    case OverTimeItem.ItemKind.Text:
                    {
                        var share = block.OverTimeKind == RevealOverTimeKind.WordsOverTime
                            ? (totalWords > 0 ? (double)item.WordCount / totalWords : 1)
                            : (totalPlain > 0 ? (double)item.PlainLength / totalPlain : 1);
                        instructions.Add(new PromptInstruction
                        {
                            Kind = PromptInstructionKind.RevealHtml,
                            Html = item.Html,
                            PlainLength = item.PlainLength,
                            WordCount = item.WordCount,
                            OverTimeKind = block.OverTimeKind,
                            DurationMs = (int)(block.DurationMs * share),
                        });
                        break;
                    }
                    case OverTimeItem.ItemKind.Wait:
                        instructions.Add(new PromptInstruction { Kind = PromptInstructionKind.Wait, Milliseconds = item.Milliseconds });
                        break;
                    case OverTimeItem.ItemKind.UpdateSpeaker:
                        instructions.Add(new PromptInstruction { Kind = PromptInstructionKind.UpdateSpeaker, SpeakerTemplate = item.SpeakerTemplate });
                        break;
                    case OverTimeItem.ItemKind.Sound:
                        instructions.Add(new PromptInstruction
                        {
                            Kind = PromptInstructionKind.PlaySound,
                            AssetId = item.AssetId,
                            DelaySeconds = item.DelaySeconds,
                            StartTime = item.StartTime,
                            EndTime = item.EndTime,
                        });
                        break;
                }
            }
            block.Items.Clear();
        }
    }
}
