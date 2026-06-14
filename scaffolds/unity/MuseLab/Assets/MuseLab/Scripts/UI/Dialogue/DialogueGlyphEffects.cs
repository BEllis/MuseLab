using System.Collections.Generic;
using TMPro;
using UnityEngine;

namespace MuseLab.UI.Dialogue
{
    public class DialogueGlyphEffects : MonoBehaviour
    {
        static readonly float[] VariantDurations = { 0.11f, 0.14f, 0.12f, 0.16f, 0.13f, 0.15f, 0.10f, 0.17f };
        static readonly float[] VariantDelays = { 0f, 0.035f, 0.07f, 0.02f, 0.055f, 0.01f, 0.045f, 0.025f };

        TMP_Text text;
        IReadOnlyList<DialogueGlyph> glyphs = System.Array.Empty<DialogueGlyph>();
        float time;
        bool disableMotion;

        public void Configure(TMP_Text target, IReadOnlyList<DialogueGlyph> glyphList, bool motionDisabled = false)
        {
            text = target;
            glyphs = glyphList ?? System.Array.Empty<DialogueGlyph>();
            disableMotion = motionDisabled;
        }

        void Update()
        {
            if (disableMotion || text == null || glyphs == null || glyphs.Count == 0) return;
            time += Time.deltaTime;
            text.ForceMeshUpdate();
            var info = text.textInfo;
            if (info.characterCount == 0) return;

            var phraseOffsets = new Dictionary<int, Vector3>();
            var glyphIndex = 0;
            for (var i = 0; i < info.characterCount; i++)
            {
                var charInfo = info.characterInfo[i];
                if (!charInfo.isVisible) continue;
                if (glyphIndex >= glyphs.Count) break;

                var glyph = glyphs[glyphIndex++];
                if (glyph.ShakeMode == DialogueShakeMode.None) continue;
                if (glyph.Character == ' ' || glyph.Character == '\n') continue;

                Vector3 offset;
                if (glyph.ShakeMode == DialogueShakeMode.Phrase)
                {
                    if (!phraseOffsets.TryGetValue(glyph.PhraseGroupId, out offset))
                    {
                        offset = PhraseOffset(glyph.PhraseGroupId);
                        phraseOffsets[glyph.PhraseGroupId] = offset;
                    }
                }
                else
                {
                    offset = CharOffset(glyph.ShakeVariant);
                }

                var verts = info.meshInfo[charInfo.materialReferenceIndex].vertices;
                for (var v = 0; v < 4; v++)
                    verts[charInfo.vertexIndex + v] += offset;
            }

            for (var m = 0; m < info.meshInfo.Length; m++)
            {
                var meshInfo = info.meshInfo[m];
                meshInfo.mesh.vertices = meshInfo.vertices;
                text.UpdateGeometry(meshInfo.mesh, m);
            }
        }

        Vector3 PhraseOffset(int groupId)
        {
            var phase = time * (2f * Mathf.PI / 0.35f) + groupId * 0.3f;
            return new Vector3(Mathf.Sin(phase) * 2f, Mathf.Cos(phase * 0.8f) * 1.5f, 0f);
        }

        Vector3 CharOffset(int variant)
        {
            var v = Mathf.Clamp(variant, 0, 7);
            var duration = VariantDurations[v];
            var delay = VariantDelays[v];
            var t = (time + delay) % duration;
            var phase = t / duration * 2f * Mathf.PI;
            return new Vector3(
                Mathf.Sin(phase * 1.4f) * 1.8f,
                Mathf.Cos(phase * 1.1f) * 1.8f,
                Mathf.Sin(phase * 0.7f) * 2f);
        }
    }
}
