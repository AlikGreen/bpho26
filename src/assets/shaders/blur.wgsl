struct Uniforms 
{
    vertical: u32,
    blurRadius: u32,
};

@group(0) @binding(0) var<uniform> params: Uniforms;
@group(0) @binding(1) var inTex: texture_storage_2d<rgba8unorm, read>;
@group(0) @binding(2) var outTex: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) 
{
    let dims = textureDimensions(inTex);
    if (id.x >= dims.x || id.y >= dims.y) { return; }

    var average = vec4f(0.0);
    var totalWeight = 0.0;

    for(var i = -i32(params.blurRadius); i <= i32(params.blurRadius); i++)
    {
        let sigma = f32(params.blurRadius) * 0.5;
        let weight = exp(-(f32(i * i)) / (2.0 * sigma * sigma));
        totalWeight += weight;

        var offset = vec2i(0, i);

        if(params.vertical == 1u)
        {
            offset = vec2i(i, 0);
        }

        let samplePos = vec2i(id.xy) + offset;

        if(samplePos.x < 0 || samplePos.y < 0 ||
        samplePos.x >= i32(dims.x) ||
        samplePos.y >= i32(dims.y))
        {
            continue;
        }

        average += textureLoad(inTex, samplePos) * weight;
    }


    textureStore(outTex, id.xy, average / totalWeight);
}