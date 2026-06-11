using TMPro;
using UnityEngine;

namespace MuseLab.UI
{
    public class ShakeTextEffect : MonoBehaviour
    {
        TMP_Text text;
        float time;

        void Awake() => text = GetComponent<TMP_Text>();

        void Update()
        {
            if (text == null) return;
            time += Time.deltaTime;
            text.ForceMeshUpdate();
            var info = text.textInfo;
            for (var i = 0; i < info.characterCount; i++)
            {
                var charInfo = info.characterInfo[i];
                if (!charInfo.isVisible) continue;
                var verts = info.meshInfo[charInfo.materialReferenceIndex].vertices;
                var offset = new Vector3(
                    Mathf.Sin(time * 14f + i * 0.7f) * 1.5f,
                    Mathf.Cos(time * 11f + i * 0.5f) * 1.5f,
                    0);
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
    }
}
