

export const BufferUsage = 
{
    Vertex:  GPUBufferUsage.VERTEX,
    Index:   GPUBufferUsage.INDEX,
    Uniform: GPUBufferUsage.UNIFORM,
    Storage: GPUBufferUsage.STORAGE,
} as const;

export type BufferUsageFlags = number;

export class Buffer
{
    private gpuBuffer: GPUBuffer;
    readonly byteLength: number;

    constructor(device: GPUDevice, data: ArrayBufferView, usage: BufferUsageFlags)
    {
        this.byteLength = data.byteLength;

        this.gpuBuffer = device.createBuffer({
            size: data.byteLength,
            usage: usage | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });

        new Uint8Array(this.gpuBuffer.getMappedRange()).set(
            new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
        );
        this.gpuBuffer.unmap();
    }

    getBuffer() { return this.gpuBuffer; }
}