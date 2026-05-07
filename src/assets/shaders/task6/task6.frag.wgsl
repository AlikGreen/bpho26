struct Uniforms 
{
    offset: vec2<f32>,
    zoom: f32,
};

struct VertexOutput 
{
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};


@group(0) @binding(0) var<uniform> params: Uniforms;
@group(0) @binding(1) var inputTex: texture_storage_2d<rgba8unorm, read>;

@fragment
fn main(input: VertexOutput) -> @location(0) vec4f 
{
    let dims = textureDimensions(inputTex);
    let ndc = input.uv * 2.0 - vec2f(1.0);
    let adjustedNdc = (ndc / params.zoom) + params.offset;
    let adjustedUv = (adjustedNdc + vec2f(1.0)) / 2.0;
    let texelCoords = vec2<i32>(i32(adjustedUv.x * f32(dims.x)), i32(adjustedUv.y * f32(dims.y)));

    return textureLoad(inputTex, texelCoords);
}