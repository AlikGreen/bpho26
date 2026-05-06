import { Texture } from "./texture";

const UniformType = 
{
    Float: 0,
    Int: 1,
    Uint: 2,
} as const;

type UniformType = typeof UniformType[keyof typeof UniformType];

interface UniformEntry 
{
    type: UniformType;
    values: number[];
}

interface TextureEntry
{
    binding: number;
    texture: Texture;
}

interface StorageTextureEntry
{
    binding: number;
    texture: Texture;
    access: GPUStorageTextureAccess;
}

interface StorageBufferEntry
{
    binding: number;
    buffer: GPUBuffer;
    readOnly: boolean;
}

export class Uniforms 
{
    private device: GPUDevice;
    private entries: UniformEntry[] = [];
    private textures: TextureEntry[] = [];
    private storageTextures: StorageTextureEntry[] = [];
    private storageBuffers: StorageBufferEntry[] = [];
    private buffer?: GPUBuffer;
    private bindGroup?: GPUBindGroup;
    private dirty = true;

    constructor(device: GPUDevice) 
    {
        this.device = device;
    }

    public setFloat(value: number) 
    {
        this.entries.push({ type: UniformType.Float, values: [value] });
        this.dirty = true;
    }

    public setVec2(x: number, y: number) 
    {
        this.entries.push({ type: UniformType.Float, values: [x, y] });
        this.dirty = true;
    }

    public setVec3(x: number, y: number, z: number) 
    {
        this.entries.push({ type: UniformType.Float, values: [x, y, z] });
        this.dirty = true;
    }

    public setVec4(x: number, y: number, z: number, w: number) 
    {
        this.entries.push({ type: UniformType.Float, values: [x, y, z, w] });
        this.dirty = true;
    }

    public setColor(r: number, g: number, b: number, a: number = 1.0) 
    {
        this.setVec4(r, g, b, a);
    }

    public setInt(value: number) 
    {
        this.entries.push({ type: UniformType.Int, values: [value] });
        this.dirty = true;
    }

    public setIVec2(x: number, y: number) 
    {
        this.entries.push({ type: UniformType.Int, values: [x, y] });
        this.dirty = true;
    }

    public setUint(value: number) 
    {
        this.entries.push({ type: UniformType.Uint, values: [value] });
        this.dirty = true;
    }
    
    public setBool(value: boolean) 
    {
        this.entries.push({ type: UniformType.Uint, values: [value ? 1 : 0] });
        this.dirty = true;
    }

    public setTexture(binding: number, texture: Texture)
    {
        this.textures.push({ binding, texture });
        this.dirty = true;
    }

    public setStorageTexture(binding: number, texture: Texture, access: GPUStorageTextureAccess = 'write-only')
    {
        this.storageTextures.push({ binding, texture, access });
        this.dirty = true;
    }

    public setStorageBuffer(binding: number, buffer: GPUBuffer, readOnly: boolean = false)
    {
        this.storageBuffers.push({ binding, buffer, readOnly });
        this.dirty = true;
    }

    public clear() 
    {
        this.entries = [];
        this.textures = [];
        this.storageTextures = [];
        this.storageBuffers = [];
        this.dirty = true;
    }

    public build(pipeline: GPURenderPipeline | GPUComputePipeline, groupIndex: number): GPUBindGroup 
    {
        if (!this.dirty && this.bindGroup) 
        {
            return this.bindGroup;
        }

        const bindGroupEntries: GPUBindGroupEntry[] = [];

        // --- Uniform buffer (binding 0) ---
        if (this.entries.length > 0)
        {
            const offsets: number[] = [];
            let byteOffset = 0;

            for (const entry of this.entries) 
            {
                const count = entry.values.length;
                const alignment = count >= 3 ? 16 : count === 2 ? 8 : 4;

                byteOffset = Math.ceil(byteOffset / alignment) * alignment;
                offsets.push(byteOffset);
                byteOffset += count * 4;
            }

            byteOffset = Math.ceil(byteOffset / 16) * 16;

            const arrayBuffer = new ArrayBuffer(byteOffset);
            const view = new DataView(arrayBuffer);

            for (let i = 0; i < this.entries.length; i++) 
            {
                const entry = this.entries[i];
                let offset = offsets[i];

                for (const value of entry.values) 
                {
                    switch (entry.type) 
                    {
                        case UniformType.Float:
                            view.setFloat32(offset, value, true);
                            break;
                        case UniformType.Int:
                            view.setInt32(offset, value, true);
                            break;
                        case UniformType.Uint:
                            view.setUint32(offset, value, true);
                            break;
                    }
                    offset += 4;
                }
            }

            if (!this.buffer || this.buffer.size < byteOffset) 
            {
                this.buffer?.destroy();
                this.buffer = this.device.createBuffer(
                {
                    size: byteOffset,
                    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
                });
            }

            this.device.queue.writeBuffer(this.buffer, 0, arrayBuffer);

            bindGroupEntries.push(
            {
                binding: 0,
                resource: { buffer: this.buffer },
            });
        }

        for (const tex of this.textures)
        {
            bindGroupEntries.push(
            {
                binding: tex.binding,
                resource: tex.texture.getSampler(),
            });

            bindGroupEntries.push(
            {
                binding: tex.binding + 1,
                resource: tex.texture.getView(),
            });
        }

        for (const tex of this.storageTextures)
        {
            bindGroupEntries.push(
            {
                binding: tex.binding,
                resource: tex.texture.getView(),
            });
        }

        for (const buf of this.storageBuffers)
        {
            bindGroupEntries.push(
            {
                binding: buf.binding,
                resource: { buffer: buf.buffer },
            });
        }

        this.bindGroup = this.device.createBindGroup(
        {
            layout: pipeline.getBindGroupLayout(groupIndex),
            entries: bindGroupEntries,
        });

        this.dirty = false;
        return this.bindGroup;
    }
}