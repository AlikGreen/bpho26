struct Uniforms 
{
    screenDistance: f32,
    screenSize: f32,
    hitColor: vec4<f32>,
    intensityMultiplier: f32,
    aspectRatio: f32,
    wavelength: f32, // nanometers
    atomCount: u32,
};

struct VertexOutput 
{
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};


@group(0) @binding(0) var<uniform> params: Uniforms;
@group(0) @binding(1) var<storage, read> atomicStructure: array<vec3f>;


@fragment
fn main(input: VertexOutput) -> @location(0) vec4f 
{
    var ndc = (input.uv * 2.0 - 1.0);
    ndc.x *= params.aspectRatio;
    let pixelPos = vec3f(ndc * params.screenSize, params.screenDistance);
    
    var realSum = 0.0;
    var imagSum = 0.0;

    let screenVec  = vec3f(pixelPos.xy, params.screenDistance);
    let screenDist = length(screenVec);
    let screenDir  = screenVec / screenDist;

    let k = 6.2831853 / params.wavelength;

    for (var i: u32 = 0; i < params.atomCount; i++) 
    {
        let atom = atomicStructure[i];

        let phase = k * dot(atom, screenDir);

        realSum += cos(phase);
        imagSum += sin(phase);
    }
    
    let intensity = (realSum * realSum + imagSum * imagSum) / f32(params.atomCount * params.atomCount);

    return vec4f(params.hitColor.rgb * intensity * params.intensityMultiplier, 1.0);
}