import './style.css'

const canvas = document.getElementById("app") as HTMLCanvasElement;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const ctx = canvas.getContext("2d")!;

ctx.fillStyle = "black";
ctx.fillRect(0, 0, canvas.width, canvas.height);
