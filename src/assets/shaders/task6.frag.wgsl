struct Uniforms 
{
    screenDistance: f32,
    screenSize: f32,
    hitColor: vec4<f32>,
    intensityMultiplier: f32,
    aspectRatio: f32,
    numAtoms: u32,
    numOrientations: u32,
    wavelength: f32, // nanometers
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

struct VertexOutput 
{
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};


@group(0) @binding(0) var<uniform> params: Uniforms;

@fragment
fn main(input: VertexOutput) -> @location(0) vec4f 
{
    let screenDist = params.screenDistance;
    let screenSize = params.screenSize;
    const latticeSpacing = 0.123; // nanometers
    let crystalOffset = f32(params.numAtoms - 1) * latticeSpacing * 0.5;
    
    var ndc = (input.uv * 2.0 - 1.0);
    ndc.x *= params.aspectRatio;
    let pixelPos = vec3f(ndc * screenSize, screenDist);
    
    var realSum = 0.0;
    var imagSum = 0.0;

    for (var orient: u32 = 0; orient < params.numOrientations; orient++) 
    {
        let angle = f32(orient) * 6.2831853 / f32(params.numOrientations);
        let ca = cos(angle);
        let sa = sin(angle);

        for (var i: u32 = 0; i < params.numAtoms; i++) 
        {
            for (var j: u32 = 0; j < params.numAtoms; j++) 
            {
                let atom = vec3f(
                    f32(i) * latticeSpacing - crystalOffset, 
                    f32(j) * latticeSpacing - crystalOffset, 
                    0.0
                );

                let rotated = vec3f(
                    atom.x * ca - atom.y * sa,
                    atom.x * sa + atom.y * ca,
                    0.0
                );

                let dist= distance(pixelPos, rotated);
                
                let fractional = fract(dist / params.wavelength);
                let phase = fractional * 6.2831853;

                realSum += cos(phase);
                imagSum += sin(phase);
            }
        }
    }

    let intensity = (realSum * realSum + imagSum * imagSum) / f32(params.numAtoms * params.numAtoms * params.numAtoms * params.numAtoms);

    return params.hitColor * intensity * params.intensityMultiplier;
}