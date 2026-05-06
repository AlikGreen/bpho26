struct Uniforms 
{
    voltage: f32,
    slitSeperation: f32,
    screenDistance: f32,
    screenSize: f32,
    hitColor: vec4<f32>,
    aspectRatio: f32,
    numAtoms: u32,
};

fn pcg3d(v: vec3u) -> vec3u
{
    var p = v * vec3u(1664525u, 1013904223u, 1210056497u) + vec3u(1013904223u, 1664525u, 1210056497u);

    p.x += p.y * p.z;
    p.y += p.z * p.x;
    p.z += p.x * p.y;

    p ^= p >> vec3u(16u);

    p.x += p.y * p.z;
    p.y += p.z * p.x;
    p.z += p.x * p.y;

    return p;
}

// Returns vec3f in [0, 1)
fn random3(id: vec3u) -> vec3f
{
    return vec3f(pcg3d(id)) / 4294967295.0;
}

// Returns f32 in [0, 1)
fn random(id: vec3u) -> f32
{
    return random3(id).x;
}

@group(0) @binding(0) var<uniform> params: Uniforms;
@group(0) @binding(1) var outputTex: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) 
{
    let dims = textureDimensions(outputTex);
    if (id.x >= dims.x || id.y >= dims.y) { return; }
    let uv = vec2f(f32(id.x) / f32(dims.x), f32(id.y) / f32(dims.y));
    
    let screenDist = params.screenDistance * 500.0;
    let screenSize = params.screenSize * 200.0;
    const wavelength = 0.5;
    const latticeSpacing = 2.0;
    let crystalOffset = f32(params.numAtoms - 1) * latticeSpacing * 0.5;
    
    let pixelPos = vec3f((uv * 2.0 - 1.0) * screenSize, screenDist);
    
    
    var realSum = 0.0;
    var imagSum = 0.0;

    for (var i: u32 = 0; i < params.numAtoms; i++) 
    {
        for (var j: u32 = 0; j < params.numAtoms; j++) 
        {
            let atom = vec3f(
                f32(i) * latticeSpacing - crystalOffset, 
                f32(j) * latticeSpacing - crystalOffset, 
                0.0
            );

            let dist= distance(pixelPos, atom);

            
            let cycles = dist / wavelength;
            let fractional = fract(cycles);  // 0 to 1, precision safe
            let phase = fractional * 6.2831853;

            realSum += cos(phase);
            imagSum += sin(phase);
        }
    }

    let intensity = (realSum * realSum + imagSum * imagSum) / f32(params.numAtoms * params.numAtoms * params.numAtoms * params.numAtoms);
    let visible = log(1.0 + intensity * 100.0) / 5.0;
    
    textureStore(outputTex, id.xy, params.hitColor * visible);
}