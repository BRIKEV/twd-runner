const reset = '\x1b[0m';

export const green = (s) => `\x1b[32m${s}${reset}`;
export const red = (s) => `\x1b[31m${s}${reset}`;
export const yellow = (s) => `\x1b[33m${s}${reset}`;
