import { Buffer } from "./buffer";
import { Texture } from "./texture";

// Tagged integer helpers for when you need u32/i32 in a struct
export const uint = (n: number) => ({ __tag: 'uint' as const, value: n });
export const int  = (n: number) => ({ __tag: 'int'  as const, value: n });

type TaggedInt = ReturnType<typeof uint> | ReturnType<typeof int>;
type StructField = boolean | number | number[] | TaggedInt;
type UniformStruct = Record<string, StructField>;

type BindingValue = UniformStruct | ArrayBuffer | ArrayBufferView | Texture | Buffer;

interface BindingOptions {
    storage?: boolean;
    storageAccess?: GPUStorageTextureAccess;
    readOnly?: boolean;
}

function packStruct(struct: UniformStruct): ArrayBuffer {
    let offset = 0;

    type PackedField = { offset: number; values: number[]; tag: 'f32' | 'u32' | 'i32' };
    const fields: PackedField[] = [];

    for (const raw of Object.values(struct)) {
        let values: number[];
        var tag: 'f32' | 'u32' | 'i32' = 'f32';

        if (typeof raw === 'boolean') 
        {
            values = [raw ? 1 : 0];
            tag = 'u32';
        } else if (typeof raw === 'number') 
        {
            values = [raw];
        } else if (Array.isArray(raw)) 
        {
            values = raw;
        } else 
        {
            // Tagged int
            values = [raw.value];
            tag = raw.__tag === 'uint' ? 'u32' : 'i32';
        }

        const count = values.length;
        const align = count >= 3 ? 16 : count === 2 ? 8 : 4;

        offset = Math.ceil(offset / align) * align;
        fields.push({ offset, values, tag });
        offset += count * 4;
    }

    const buffer = new ArrayBuffer(Math.ceil(offset / 16) * 16);
    const view = new DataView(buffer);

    for (const { offset, values, tag } of fields) {
        let o = offset;
        for (const v of values) {
            if      (tag === 'f32') view.setFloat32(o, v, true);
            else if (tag === 'u32') view.setUint32 (o, v, true);
            else                    view.setInt32  (o, v, true);
            o += 4;
        }
    }

    return buffer;
}

function isUniformStruct(value: BindingValue): value is UniformStruct {
    return (
        typeof value === 'object' &&
        !(value instanceof ArrayBuffer) &&
        !ArrayBuffer.isView(value) &&
        !(value instanceof Texture) &&
        !(value instanceof GPUBuffer)
    );
}

export class Uniforms 
{
    private device: GPUDevice;
    private entries = new Map<number, { value: BindingValue; options?: BindingOptions }>();
    private uniformBuffers = new Map<number, GPUBuffer>();
    private bindGroup?: GPUBindGroup;
    private dirty = true;

    constructor(device: GPUDevice) 
    {
        this.device = device;
    }

    public set(binding: number, value: BindingValue, options?: BindingOptions): this 
    {
        this.entries.set(binding, { value, options });
        this.dirty = true;
        return this;
    }

    public clear(): this 
    {
        this.entries.clear();
        this.dirty = true;
        return this;
    }

    public build(pipeline: GPURenderPipeline | GPUComputePipeline, groupIndex: number): GPUBindGroup 
    {
        if (!this.dirty && this.bindGroup) return this.bindGroup;

        const gpuEntries: GPUBindGroupEntry[] = [];

        for (const [binding, { value, options }] of this.entries) 
        {
            if (value instanceof Texture) 
            {
                if (options?.storage)
                {
                    gpuEntries.push({ binding, resource: value.getView() });
                } else 
                {
                    gpuEntries.push({ binding,     resource: value.getSampler() });
                    gpuEntries.push({ binding: binding + 1, resource: value.getView() });
                }
            } else if (value instanceof Buffer) 
            {
                gpuEntries.push({ binding, resource: { buffer: value.getBuffer() } });
            } else 
            {
                const raw = isUniformStruct(value)
                    ? packStruct(value)
                    : value instanceof ArrayBuffer
                        ? value
                        : value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);

                const size = Math.ceil((raw as ArrayBuffer).byteLength / 16) * 16;
                let buf = this.uniformBuffers.get(binding);
                if (!buf || buf.size < size)
                {
                    buf?.destroy();
                    buf = this.device.createBuffer({ size, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
                    this.uniformBuffers.set(binding, buf);
                }

                this.device.queue.writeBuffer(buf, 0, raw as ArrayBuffer);
                gpuEntries.push({ binding, resource: { buffer: buf } });
            }
        }

        this.bindGroup = this.device.createBindGroup({
            layout: pipeline.getBindGroupLayout(groupIndex),
            entries: gpuEntries,
        });

        this.dirty = false;
        return this.bindGroup;
    }
}