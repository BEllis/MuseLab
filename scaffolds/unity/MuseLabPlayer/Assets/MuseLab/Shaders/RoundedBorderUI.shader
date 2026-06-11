Shader "MuseLab/RoundedBorderUI"
{
    Properties
    {
        _MainTex ("Sprite Texture", 2D) = "white" {}
        _FillColor ("Fill Color", Color) = (0.77, 0.87, 0.94, 1)
        _BorderColor ("Border Color", Color) = (0.12, 0.35, 0.54, 1)
        _BorderWidth ("Border Width", Float) = 2
        _RectSize ("Rect Size", Vector) = (100, 100, 0, 0)
        _CornerRadii ("Corner Radii TR BR TL BL", Vector) = (12, 12, 12, 12)
        _BorderSides ("Border Sides Top Right Bottom Left", Vector) = (1, 1, 1, 1)

        _StencilComp ("Stencil Comparison", Float) = 8
        _Stencil ("Stencil ID", Float) = 0
        _StencilOp ("Stencil Operation", Float) = 0
        _StencilWriteMask ("Stencil Write Mask", Float) = 255
        _StencilReadMask ("Stencil Read Mask", Float) = 255

        _ColorMask ("Color Mask", Float) = 15
        _ClipRect ("Clip Rect", Vector) = (-32767, -32767, 32767, 32767)
        [Toggle(UNITY_UI_ALPHACLIP)] _UseUIAlphaClip ("Use Alpha Clip", Float) = 0
    }

    SubShader
    {
        Tags
        {
            "Queue"="Transparent"
            "IgnoreProjector"="True"
            "RenderType"="Transparent"
            "PreviewType"="Plane"
            "CanUseSpriteAtlas"="True"
        }

        Stencil
        {
            Ref [_Stencil]
            Comp [_StencilComp]
            Pass [_StencilOp]
            ReadMask [_StencilReadMask]
            WriteMask [_StencilWriteMask]
        }

        Cull Off
        Lighting Off
        ZWrite Off
        ZTest [unity_GUIZTestMode]
        Blend SrcAlpha OneMinusSrcAlpha
        ColorMask [_ColorMask]

        Pass
        {
            Name "RoundedBorder"
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma target 2.0
            #pragma multi_compile __ UNITY_UI_CLIP_RECT
            #pragma multi_compile __ UNITY_UI_ALPHACLIP

            #include "UnityCG.cginc"
            #include "UnityUI.cginc"

            struct appdata_t
            {
                float4 vertex : POSITION;
                float4 color : COLOR;
                float2 texcoord : TEXCOORD0;
                UNITY_VERTEX_INPUT_INSTANCE_ID
            };

            struct v2f
            {
                float4 vertex : SV_POSITION;
                fixed4 color : COLOR;
                float2 texcoord : TEXCOORD0;
                float4 mask : TEXCOORD1;
                UNITY_VERTEX_OUTPUT_STEREO
            };

            sampler2D _MainTex;
            fixed4 _TextureSampleAdd;
            float4 _ClipRect;
            float4 _FillColor;
            float4 _BorderColor;
            float _BorderWidth;
            float4 _RectSize;
            float4 _CornerRadii;
            float4 _BorderSides;
            float _UIMaskSoftnessX;
            float _UIMaskSoftnessY;

            float sdRoundBox(float2 p, float2 halfSize, float4 radii)
            {
                radii.xy = (p.x > 0.0) ? radii.xy : radii.zw;
                radii.x = (p.y > 0.0) ? radii.x : radii.y;
                float2 q = abs(p) - halfSize + radii.x;
                return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radii.x;
            }

            float4 sampleSprite(v2f IN)
            {
                return (tex2D(_MainTex, IN.texcoord) + _TextureSampleAdd) * IN.color;
            }

            v2f vert(appdata_t v)
            {
                v2f OUT;
                UNITY_SETUP_INSTANCE_ID(v);
                UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(OUT);
                float4 vPosition = UnityObjectToClipPos(v.vertex);
                OUT.vertex = vPosition;
                OUT.texcoord = v.texcoord;
                OUT.color = v.color;

                float2 pixelSize = vPosition.w;
                pixelSize /= abs(mul((float2x2)UNITY_MATRIX_P, _ScreenParams.xy));
                float4 clampedRect = clamp(_ClipRect, -2e10, 2e10);
                OUT.mask = half4(
                    v.vertex.xy * 2.0 - clampedRect.xy - clampedRect.zw,
                    0.25 / (0.25 * half2(_UIMaskSoftnessX, _UIMaskSoftnessY) + abs(pixelSize.xy)));
                return OUT;
            }

            float flatEdgeMask(float2 pos, float2 halfSize, float borderWidth, float4 radii, float4 enabledSides)
            {
                float r_tl = radii.z;
                float r_tr = radii.x;
                float r_br = radii.y;
                float r_bl = radii.w;

                float topFlat = step(halfSize.y - borderWidth, pos.y)
                    * step(-halfSize.x + r_tl, pos.x)
                    * step(pos.x, halfSize.x - r_tr);
                float bottomFlat = step(pos.y, -halfSize.y + borderWidth)
                    * step(-halfSize.x + r_bl, pos.x)
                    * step(pos.x, halfSize.x - r_br);
                float leftFlat = step(pos.x, -halfSize.x + borderWidth)
                    * step(-halfSize.y + r_bl, pos.y)
                    * step(pos.y, halfSize.y - r_tl);
                float rightFlat = step(halfSize.x - borderWidth, pos.x)
                    * step(-halfSize.y + r_br, pos.y)
                    * step(pos.y, halfSize.y - r_tr);

                return saturate(
                    (1.0 - enabledSides.x) * topFlat +
                    (1.0 - enabledSides.y) * rightFlat +
                    (1.0 - enabledSides.z) * bottomFlat +
                    (1.0 - enabledSides.w) * leftFlat);
            }

            fixed4 frag(v2f IN) : SV_Target
            {
                float2 rectSize = max(_RectSize.xy, float2(1.0, 1.0));
                float2 halfSize = rectSize * 0.5;
                float2 pos = (IN.texcoord - 0.5) * rectSize;
                float borderWidth = max(_BorderWidth, 0.0);

                float4 radii = max(_CornerRadii, float4(0.0, 0.0, 0.0, 0.0));
                float2 innerHalfSize = max(halfSize - borderWidth, float2(0.0, 0.0));
                float4 innerRadii = max(radii - borderWidth, float4(0.0, 0.0, 0.0, 0.0));

                float outerDist = sdRoundBox(pos, halfSize, radii);
                float innerDist = sdRoundBox(pos, innerHalfSize, innerRadii);

                float aa = max(fwidth(outerDist), 1.0);
                float insideOuter = 1.0 - smoothstep(-aa, aa, outerDist);
                clip(insideOuter - 0.001);

                float insideInner = 1.0 - smoothstep(-aa, aa, innerDist);
                float borderAlpha = insideOuter - insideInner;
                borderAlpha *= 1.0 - flatEdgeMask(pos, halfSize, borderWidth, radii, _BorderSides);

                float4 sprite = sampleSprite(IN);
                float4 fill = _FillColor * sprite;
                float4 border = _BorderColor * sprite;
                float4 color = lerp(fill, border, saturate(borderAlpha));
                color.a *= insideOuter;

                #ifdef UNITY_UI_CLIP_RECT
                half2 clipMask = saturate((_ClipRect.zw - _ClipRect.xy - abs(IN.mask.xy)) * IN.mask.zw);
                color.a *= clipMask.x * clipMask.y;
                #endif

                #ifdef UNITY_UI_ALPHACLIP
                clip(color.a - 0.001);
                #endif

                return color;
            }
            ENDCG
        }
    }
}
