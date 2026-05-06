struct VertexOutput 
{
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

struct VertexInput 
{
    @location(0) position: vec2<f32>,
    @location(1) uv: vec2<f32>,
};

@vertex
fn main(input: VertexInput) -> VertexOutput
{
    var output: VertexOutput;
    output.position = vec4<f32>(input.position, 0.0, 1.0);
    output.uv = input.uv;
    return output;
}