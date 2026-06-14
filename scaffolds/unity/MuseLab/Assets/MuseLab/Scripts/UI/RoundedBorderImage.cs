using UnityEngine;
using UnityEngine.UI;

namespace MuseLab.UI
{
    [DisallowMultipleComponent]
    [RequireComponent(typeof(Image))]
    public class RoundedBorderImage : MonoBehaviour, IMaterialModifier
    {
        static readonly int FillColorId = Shader.PropertyToID("_FillColor");
        static readonly int BorderColorId = Shader.PropertyToID("_BorderColor");
        static readonly int BorderWidthId = Shader.PropertyToID("_BorderWidth");
        static readonly int RectSizeId = Shader.PropertyToID("_RectSize");
        static readonly int CornerRadiiId = Shader.PropertyToID("_CornerRadii");
        static readonly int BorderSidesId = Shader.PropertyToID("_BorderSides");

        static Shader shader;
        static Sprite whiteSprite;

        Material runtimeMaterial;
        RectTransform rectTransform;
        Image image;

        Color fillColor = MuseLabUiStyles.PanelBlue;
        Color borderColor = MuseLabUiStyles.BorderBlue;
        float borderWidth = MuseLabUiStyles.BorderWidth;
        Vector4 cornerRadii = CornerRadii(12, 12, 12, 12);
        Vector4 borderSides = BorderSidesAll;

        public static Vector4 BorderSidesAll => new(1, 1, 1, 1);
        public static Vector4 BorderSidesNoTop => new(0, 1, 1, 1);
        public static Vector4 BorderSidesNoBottom => new(1, 1, 0, 1);

        public static Vector4 CornerRadii(float topLeft, float topRight, float bottomRight, float bottomLeft)
            => new(topRight, bottomRight, topLeft, bottomLeft);

        public static RoundedBorderImage Apply(Image target)
        {
            var graphic = target.GetComponent<RoundedBorderImage>() ?? target.gameObject.AddComponent<RoundedBorderImage>();
            graphic.Initialize(target);
            return graphic;
        }

        void Awake()
        {
            if (image == null)
                Initialize(GetComponent<Image>());
        }

        void Initialize(Image target)
        {
            image = target;
            rectTransform = target.rectTransform;
            EnsureShader();
            target.sprite = GetWhiteSprite();
            target.type = Image.Type.Simple;
            target.color = Color.white;
            target.material = null;
            ApplyToMaterial();
        }

        public void SetStyle(
            Color fill,
            Color border,
            float width,
            Vector4 corners,
            Vector4 sides)
        {
            fillColor = fill;
            borderColor = border;
            borderWidth = width;
            cornerRadii = corners;
            borderSides = sides;
            ApplyToMaterial();
            image?.SetMaterialDirty();
        }

        public void OnRectTransformDimensionsChange()
        {
            ApplyToMaterial();
            image?.SetMaterialDirty();
        }

        public Material GetModifiedMaterial(Material baseMaterial)
        {
            EnsureShader();
            if (runtimeMaterial == null || runtimeMaterial.shader != shader)
                runtimeMaterial = new Material(shader);

            ApplyToMaterial();
            return runtimeMaterial;
        }

        void ApplyToMaterial()
        {
            if (runtimeMaterial == null || rectTransform == null) return;
            var size = rectTransform.rect.size;
            runtimeMaterial.SetColor(FillColorId, fillColor);
            runtimeMaterial.SetColor(BorderColorId, borderColor);
            runtimeMaterial.SetFloat(BorderWidthId, borderWidth);
            runtimeMaterial.SetVector(RectSizeId, new Vector4(Mathf.Max(size.x, 1f), Mathf.Max(size.y, 1f), 0f, 0f));
            runtimeMaterial.SetVector(CornerRadiiId, cornerRadii);
            runtimeMaterial.SetVector(BorderSidesId, borderSides);
        }

        static void EnsureShader()
        {
            if (shader != null) return;
            shader = Shader.Find("MuseLab/RoundedBorderUI");
            if (shader == null)
                throw new MissingReferenceException("Shader MuseLab/RoundedBorderUI was not found.");
        }

        static Sprite GetWhiteSprite()
        {
            if (whiteSprite != null) return whiteSprite;

            var texture = Texture2D.whiteTexture;
            whiteSprite = Sprite.Create(texture, new Rect(0, 0, texture.width, texture.height), new Vector2(0.5f, 0.5f));
            return whiteSprite;
        }

        void OnDestroy()
        {
            if (runtimeMaterial != null)
                Destroy(runtimeMaterial);
        }
    }
}
