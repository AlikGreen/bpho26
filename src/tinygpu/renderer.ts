import { assert } from "../util";
import { Buffer, type BufferUsageFlags } from "./buffer";
import { Shader } from "./shader";
import { Texture, TextureFormat, type TextureUsageFlags } from "./texture";
import { Uniforms } from "./uniforms";

function hash2(a: number, b: number): number
{
    let hash = a | 0;

    hash = (hash * 31) ^ (b | 0);

    return hash | 0;
}

export const VertexFormat = 
{
    Float: 'float32',
    Float2: 'float32x2',
    Float3: 'float32x3',
    Float4: 'float32x4',
} as const;

export type VertexFormat = typeof VertexFormat[keyof typeof VertexFormat];

const vertexFormatSizes: Record<VertexFormat, number> = 
{
    [VertexFormat.Float]: 4,
    [VertexFormat.Float2]: 8,
    [VertexFormat.Float3]: 12,
    [VertexFormat.Float4]: 16,
};

export class Renderer
{
    private context: GPUCanvasContext
    private device: GPUDevice;
    private renderCbs : Array<() => void> = [];
    private presentationFormat: GPUTextureFormat;

    private cachedRenderPipelines: Map<string, GPURenderPipeline> = new Map();
    private cachedComputePipelines: Map<string, GPUComputePipeline> = new Map();

    private currentVertexBuffer?: Buffer;
    private currentVertexLayout: VertexFormat[] = [];
    private currentUniforms?: Uniforms;

    private commandEncoder: GPUCommandEncoder;
    private renderPass: GPURenderPassEncoder | null = null;
    private computePass: GPUComputePassEncoder | null = null;

    private vertShader: Shader | null = null;
    private fragShader: Shader | null = null;
    private computeShader: Shader | null = null;
    
    private constructor(device: GPUDevice, canvas: HTMLCanvasElement)
    {
        this.device = device;
        this.context = canvas.getContext('webgpu') as GPUCanvasContext;

        const observer = new ResizeObserver(() => 
        {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
        });
        observer.observe(canvas);

        this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure(
        {
            device,
            format: this.presentationFormat,
            alphaMode: 'opaque',
        });

        this.commandEncoder = this.device.createCommandEncoder();
    }

    public static async create(canvas: HTMLCanvasElement): Promise<Renderer>
    {
        const adapter = await navigator.gpu.requestAdapter();
        assert(adapter != null);
        const device = await adapter.requestDevice()
        return new Renderer(device, canvas);
    }

    public onRender(cb: () => void)
    {
        this.renderCbs.push(cb);
    }

    public run()
    {
        const render = () => 
        {
            this.renderCbs.forEach(cb => cb());

            requestAnimationFrame(render);
        }

        render();
    }


    public createShader(source: string) : Shader
    {
        return new Shader(source, this.device);
    } 

    public createUniforms() : Uniforms
    {
        return new Uniforms(this.device);
    }

    public createTexture(
        width: number,
        height: number,
        format: TextureFormat,
        usage: TextureUsageFlags,
        samplerDescriptor?: GPUSamplerDescriptor
        ): Texture
    {
        return new Texture(this.device, width, height, format, usage, samplerDescriptor);
    }

    public async createTextureFromURL(url: string, usage?: TextureUsageFlags): Promise<Texture>
    {
        return Texture.fromURL(this.device, url, usage);
    }

    public async createTextureFromImage(
        image: HTMLImageElement | ImageBitmap,
        usage?: TextureUsageFlags
    ): Promise<Texture>
    {
        return Texture.fromImage(this.device, image, usage);
    }

    public setVertShader(shader: Shader)
    {
        this.vertShader = shader;
    }

    public setFragShader(shader: Shader)
    {
        this.fragShader = shader;
    }

    public setComputeShader(shader: Shader)
    {
        this.computeShader = shader;
    }

    public setUniforms(uniforms: Uniforms) 
    {
        this.currentUniforms = uniforms;
    }

    public setVertexBuffer(buffer: Buffer, layout: VertexFormat[])
    {
        this.currentVertexBuffer = buffer;
        this.currentVertexLayout = layout;
    }

    public draw(count: number)
    {
        assert(this.fragShader != null && this.vertShader != null);

        let arrayStride = 0;
        const attributes: GPUVertexAttribute[] = [];

        for (let i = 0; i < this.currentVertexLayout.length; i++)
        {
            const fmt = this.currentVertexLayout[i];
            attributes.push({
                shaderLocation: i,
                offset: arrayStride,
                format: fmt,
            });
            arrayStride += vertexFormatSizes[fmt];
        }

        const bufferLayout: GPUVertexBufferLayout = {
            arrayStride,
            attributes,
            stepMode: 'vertex',
        };

        const shaderHash = hash2(this.fragShader.getHash(), this.vertShader.getHash());
        const layoutKey = this.currentVertexLayout.join('-');
        const pipelineKey = `${shaderHash}_${layoutKey}`;

        if(!this.cachedRenderPipelines.has(pipelineKey))
        {
            const hasLayout = this.currentVertexLayout.length > 0;

            const pipeline = this.device.createRenderPipeline({
                layout: 'auto',
                vertex: 
                {
                    module: this.vertShader.getModule(),
                    entryPoint: 'main',
                    buffers: hasLayout ? [bufferLayout] : [],
                },
                fragment: 
                {
                    module: this.fragShader.getModule(),
                    entryPoint: 'main',
                    targets: 
                    [
                        {
                            format: this.presentationFormat,
                        },
                    ],
                },
                primitive: 
                {
                    topology: 'triangle-list',
                },
            });

            this.cachedRenderPipelines.set(pipelineKey, pipeline);
        }

        const pipeline = this.cachedRenderPipelines.get(pipelineKey)!;

        assert(this.renderPass != null);
        this.renderPass.setPipeline(pipeline);

        if (this.currentVertexBuffer && this.currentVertexLayout.length > 0)
        {
            this.renderPass.setVertexBuffer(0, this.currentVertexBuffer.getBuffer());
        }

        if (this.currentUniforms) 
        {
            this.renderPass.setBindGroup(0, this.currentUniforms.build(pipeline, 0));
        }

        this.renderPass.draw(count);
    }

    public createBuffer(data: ArrayBufferView, usage: BufferUsageFlags): Buffer
    {
        return new Buffer(this.device, data, usage);
    }


    public beginRender(): void
    {
        this.commandEncoder = this.device.createCommandEncoder();

        const view = this.context.getCurrentTexture().createView();

        this.renderPass = this.commandEncoder.beginRenderPass(
        {
            colorAttachments:
            [
                {
                    view: view,
                    loadOp: "clear",
                    storeOp: "store",
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                },
            ],
        });
    }

    public endRender(): void
    {
        if (this.renderPass !== null)
        {
            this.renderPass.end();
            this.renderPass = null;
        }
        this.device.queue.submit([this.commandEncoder.finish()]);
    }

    public beginCompute(): void
    {
        this.commandEncoder = this.device.createCommandEncoder();

        this.computePass = this.commandEncoder.beginComputePass();
    }

    public endCompute(): void
    {
        if (this.computePass !== null)
        {
            this.computePass.end();
            this.computePass = null;
        }
        this.device.queue.submit([this.commandEncoder.finish()]);
    }

    public dispatch(x: number, y: number = 1, z: number = 1)
    {
        assert(this.computeShader != null);

        const shaderHash = this.computeShader.getHash();
        const pipelineKey = `${shaderHash}`;

        if (!this.cachedComputePipelines.has(pipelineKey))
        {
            const pipeline = this.device.createComputePipeline(
            {
                layout: 'auto',
                compute:
                {
                    module: this.computeShader.getModule(),
                    entryPoint: 'main',
                },
            });

            this.cachedComputePipelines.set(pipelineKey, pipeline);
        }

        const pipeline = this.cachedComputePipelines.get(pipelineKey)!;

        assert(this.computePass != null);

        this.computePass.setPipeline(pipeline);

        if (this.currentUniforms)
        {
            this.computePass.setBindGroup(0, this.currentUniforms.build(pipeline, 0));
        }

        this.computePass.dispatchWorkgroups(x, y, z);
    }
}