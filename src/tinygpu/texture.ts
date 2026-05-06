
export const TextureFormat = 
{
    RGBA8Unorm:  'rgba8unorm',
    RGBA16Float: 'rgba16float',
    RGBA32Float: 'rgba32float',
    R32Float:    'r32float',
    Depth24:     'depth24plus',
} as const;

export type TextureFormat = typeof TextureFormat[keyof typeof TextureFormat];

export const TextureUsage = 
{
    TextureBinding: GPUTextureUsage.TEXTURE_BINDING,
    StorageBinding: GPUTextureUsage.STORAGE_BINDING,
    RenderAttachment: GPUTextureUsage.RENDER_ATTACHMENT,
    CopySrc: GPUTextureUsage.COPY_SRC,
    CopyDst: GPUTextureUsage.COPY_DST,
} as const;

export type TextureUsageFlags = number;

export class Texture 
{
    private texture: GPUTexture;
    private view: GPUTextureView;
    private sampler: GPUSampler;
    private device: GPUDevice;
    private width: number;
    private height: number;
    private format: TextureFormat;

    constructor(
        device: GPUDevice,
        width: number,
        height: number,
        format: TextureFormat,
        usage: TextureUsageFlags,
        samplerDescriptor?: GPUSamplerDescriptor
    ) {
        this.device = device;
        this.width = width;
        this.height = height;
        this.format = format;

        this.texture = device.createTexture({
            size: { width, height, depthOrArrayLayers: 1 },
            format,
            usage,
        });

        this.view = this.texture.createView();

        this.sampler = device.createSampler(samplerDescriptor ?? {
            magFilter: 'linear',
            minFilter: 'linear',
            mipmapFilter: 'linear',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
        });
    }

    // Create from an HTMLImageElement/ImageBitmap
    public static async fromImage(
        device: GPUDevice,
        image: HTMLImageElement | ImageBitmap,
        usage: TextureUsageFlags = 
            GPUTextureUsage.TEXTURE_BINDING | 
            GPUTextureUsage.COPY_DST |
            GPUTextureUsage.RENDER_ATTACHMENT
    ): Promise<Texture> 
    {
        const bitmap = image instanceof ImageBitmap 
            ? image 
            : await createImageBitmap(image);

        const texture = new Texture(
            device,
            bitmap.width,
            bitmap.height,
            TextureFormat.RGBA8Unorm,
            usage
        );

        device.queue.copyExternalImageToTexture(
            { source: bitmap },
            { texture: texture.getTexture() },
            { width: bitmap.width, height: bitmap.height }
        );

        return texture;
    }

    // Create from a URL
    public static async fromURL(
        device: GPUDevice,
        url: string,
        usage?: TextureUsageFlags
    ): Promise<Texture> 
    {
        const response = await fetch(url);
        const blob = await response.blob();
        const bitmap = await createImageBitmap(blob);
        return Texture.fromImage(device, bitmap, usage);
    }

    // Write raw pixel data to the texture
    public write(data: ArrayBufferView, bytesPerRow?: number): void
    {
        const defaultBytesPerRow = this.width * this.getBytesPerPixel();

        this.device.queue.writeTexture(
            { texture: this.texture },
            data,
            { 
                bytesPerRow: bytesPerRow ?? defaultBytesPerRow,
                rowsPerImage: this.height,
            },
            { 
                width: this.width, 
                height: this.height 
            }
        );
    }

    private getBytesPerPixel(): number
    {
        switch (this.format) 
        {
            case TextureFormat.RGBA8Unorm:  return 4;
            case TextureFormat.RGBA16Float: return 8;
            case TextureFormat.RGBA32Float: return 16;
            case TextureFormat.R32Float:    return 4;
            case TextureFormat.Depth24:     return 4;
            default: return 4;
        }
    }

    public getTexture(): GPUTexture   { return this.texture; }
    public getView(): GPUTextureView  { return this.view; }
    public getSampler(): GPUSampler   { return this.sampler; }
    public getWidth(): number         { return this.width; }
    public getHeight(): number        { return this.height; }
    public getFormat(): TextureFormat { return this.format; }

    public destroy(): void
    {
        this.texture.destroy();
    }
}