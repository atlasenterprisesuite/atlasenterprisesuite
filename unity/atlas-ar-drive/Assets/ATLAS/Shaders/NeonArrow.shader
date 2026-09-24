Shader "ATLAS/AR/NeonArrow"
{
    Properties
    {
        _Color("Neon Color", Color) = (0.10, 0.75, 1.0, 0.72)
        _Intensity("Emission Intensity", Range(0, 12)) = 5
        _FresnelPower("Fresnel Power", Range(0.25, 8)) = 2.2
        _PulseSpeed("Pulse Speed", Range(0, 8)) = 1.8
        _PulseAmount("Pulse Amount", Range(0, 1)) = 0.18
    }

    SubShader
    {
        Tags
        {
            "RenderType"="Transparent"
            "Queue"="Transparent+20"
            "RenderPipeline"="UniversalPipeline"
        }

        Pass
        {
            Name "NeonArrow"
            Tags { "LightMode"="UniversalForward" }
            Blend One One
            ZWrite Off
            ZTest LEqual
            Cull Off

            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            struct Attributes
            {
                float4 positionOS : POSITION;
                float3 normalOS : NORMAL;
            };

            struct Varyings
            {
                float4 positionCS : SV_POSITION;
                float3 normalWS : TEXCOORD0;
                float3 viewDirWS : TEXCOORD1;
            };

            CBUFFER_START(UnityPerMaterial)
                float4 _Color;
                float _Intensity;
                float _FresnelPower;
                float _PulseSpeed;
                float _PulseAmount;
            CBUFFER_END

            Varyings vert(Attributes input)
            {
                Varyings output;
                float3 positionWS = TransformObjectToWorld(input.positionOS.xyz);
                output.positionCS = TransformWorldToHClip(positionWS);
                output.normalWS = TransformObjectToWorldNormal(input.normalOS);
                output.viewDirWS = GetWorldSpaceNormalizeViewDir(positionWS);
                return output;
            }

            half4 frag(Varyings input) : SV_Target
            {
                float3 n = normalize(input.normalWS);
                float3 v = normalize(input.viewDirWS);
                float fresnel = pow(1.0 - saturate(abs(dot(n, v))), _FresnelPower);
                float pulse = 1.0 + sin(_Time.y * _PulseSpeed) * _PulseAmount;
                float alpha = saturate(_Color.a * (0.42 + fresnel * 0.58));
                float3 emission = _Color.rgb * _Intensity * pulse * (0.55 + fresnel);
                return half4(emission * alpha, alpha);
            }
            ENDHLSL
        }
    }
}
