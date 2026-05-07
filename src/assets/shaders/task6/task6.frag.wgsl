struct Uniforms 
{
    intensityMultiplier: f32,
    hitColor: vec4<f32>,
    atomCount: u32,
    offset: vec2<f32>,
    zoom: f32,
};

struct VertexOutput 
{
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};


@group(0) @binding(0) var<uniform> params: Uniforms;
@group(0) @binding(1) var realTex: texture_storage_2d<r32float, read>;
@group(0) @binding(2) var imagTex: texture_storage_2d<r32float, read>;


@fragment
fn main(input: VertexOutput) -> @location(0) vec4f 
{
    let dims = textureDimensions(realTex);
    let ndc = input.uv * 2.0 - vec2f(1.0);
    let adjustedNdc = (ndc / params.zoom) + params.offset;
    let adjustedUv = (adjustedNdc + vec2f(1.0)) / 2.0;
    let texelCoords = vec2<i32>(i32(adjustedUv.x * f32(dims.x)), i32(adjustedUv.y * f32(dims.y)));

    var realSum = textureLoad(realTex, texelCoords).x;
    var imagSum = textureLoad(imagTex, texelCoords).x;

    let intensity = (realSum * realSum + imagSum * imagSum) / f32(params.atomCount * params.atomCount);

    return vec4f(params.hitColor.rgb * intensity * params.intensityMultiplier, 1.0);
}