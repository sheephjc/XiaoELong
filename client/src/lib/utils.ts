import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * 合并 className，遵循 shadcn 模板约定：
 * - clsx 处理条件/数组
 * - twMerge 解决 tailwind class 冲突（后面的覆盖前面的）
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
