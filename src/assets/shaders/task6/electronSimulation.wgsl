struct Uniforms 
{
    wavelength: f32,
    screenDistance: f32,
    screenSize: f32,
    atomCount: u32,
};

@group(0) @binding(0) var<uniform> params: Uniforms;
@group(0) @binding(1) var<uniform> atoms: array<vec4f, 512>;
@group(0) @binding(2) var realTex: texture_storage_2d<r32float, read_write>;
@group(0) @binding(3) var imagTex: texture_storage_2d<r32float, read_write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) 
{
    let dims = textureDimensions(realTex);
    if (id.x >= dims.x || id.y >= dims.y) { return; }
    let uv = vec2f(f32(id.x) / f32(dims.x), f32(id.y) / f32(dims.y));

    var ndc = (uv * 2.0 - 1.0);
    let pixelPos = vec3f(ndc * params.screenSize, params.screenDistance);

    let screenVec  = vec3f(pixelPos.xy, params.screenDistance);
    let screenDir  = normalize(screenVec);
    
    var realSum= textureLoad(realTex, id.xy).x;
    var imagSum= textureLoad(imagTex, id.xy).x;

    for(var i = 0; i < i32(params.atomCount); i++)
    {
        let atom = vec3f(atoms[i].x, atoms[i].y, atoms[i].z);
        let k = 6.2831853 / params.wavelength;
        let phase = k * dot(atom, screenDir);

        realSum += cos(phase);
        imagSum += sin(phase);
    }
    
    textureStore(realTex, id.xy, vec4f(realSum, 0.0, 0.0, 0.0));
    textureStore(imagTex, id.xy, vec4f(imagSum, 0.0, 0.0, 0.0));
}