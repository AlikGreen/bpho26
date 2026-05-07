struct Uniforms 
{
    intensityMultiplier: f32,
    hitColor: vec4<f32>,
    atomCount: u32,
};


@group(0) @binding(0) var<uniform> params: Uniforms;
@group(0) @binding(1) var realTex: texture_storage_2d<r32float, read>;
@group(0) @binding(2) var imagTex: texture_storage_2d<r32float, read>;
@group(0) @binding(3) var outTex: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u)
{
    let dims = textureDimensions(realTex);
    if (id.x >= dims.x || id.y >= dims.y) { return; }
    let uv = vec2f(f32(id.x) / f32(dims.x), f32(id.y) / f32(dims.y));

    let texelCoords = vec2<i32>(i32(uv.x * f32(dims.x)), i32(uv.y * f32(dims.y)));

    var realSum = textureLoad(realTex, texelCoords).x;
    var imagSum = textureLoad(imagTex, texelCoords).x;

    let intensity = (realSum * realSum + imagSum * imagSum) / f32(params.atomCount * params.atomCount);

    textureStore(outTex, texelCoords, vec4f(params.hitColor.rgb * intensity * params.intensityMultiplier, 1.0));
}