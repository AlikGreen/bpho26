
function hashString(str: string): number
{
    let hash = 5381;

    for (let i = 0; i < str.length; i++)
    {
        hash = (hash * 33) ^ str.charCodeAt(i);
    }

    return hash >>> 0; // unsigned
}

export class Shader
{
    private module: GPUShaderModule;
    private hash: number;
    
    public constructor(source: string, device: GPUDevice)
    {
        this.module = device.createShaderModule({ code: source });
        this.hash = hashString(source);

        this.module.getCompilationInfo().then(info =>
        {
            for (const msg of info.messages)
            {
                const loc = `${msg.lineNum}:${msg.linePos}`;
                if (msg.type === 'error')   console.error(`[shader] ${loc} ${msg.message}`);
                if (msg.type === 'warning') console.warn (`[shader] ${loc} ${msg.message}`);
            }
        });
    }

    public getModule(): GPUShaderModule
    {
        return this.module;
    }

    public getHash(): number
    {
        return this.hash;
    }
}