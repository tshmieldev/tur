let evalPtr = 0;

const funcFict = {
    'c': {
        fn: capitalizeArgs,
        argc: Infinity
    },
    'rand': {
        fn: async () => String(Math.floor(Math.random() * 100)),
        argc: 0
    },
    'rev': {
        fn: async (args: string[]) => args.map(arg => arg.split('').reverse().join('')).reverse(),
        argc: Infinity
    },
	'eatP': {
		fn: async (args: string[]) => `EatPooPoo ${args.join(' ')} nymnCorn`,
		argc: Infinity
	},
	'catFact': {
		fn: async () => {
			const data = await fetch('https://catfact.ninja/fact');
			const json = await data.json();
			return json.fact;
		},
		argc: 0,
        unsafe: true
	},
	'mock': {
		fn: async (args: string[]) => args.map(arg => arg.split('').map((c) =>  Math.random()>0.5? c.toLowerCase() : c.toUpperCase()).join('')),
		argc: Infinity,
		unsafe: true
	},
    '_': {
        fn: async () => '\\\\',
        argc: 0
    },
    'sorta': {
        fn: async (args: string[]) => {let buf = args.reduce((p, c) => p+c); return buf.split(' ').sort().join(' ')},
        argc: Infinity
    },
    'sortn': {
        fn: async (args: string[]) => {let buf = args.reduce((p, c) => p+c); return buf.split(' ').sort((a,b)=>parseInt(a)-parseInt(b)).join(' ')},
        argc: Infinity
    },
    'revw': {
        fn: async (args: string[]) => args.map(arg => arg.split(' ').reverse().join('')).reverse(),
        argc: Infinity
    },
    'add': {
        fn: async (args: string[]) => String(parseInt(args[0]) + parseInt(args[1])),
        argc: 2
    },
    'mul': {
        fn: async (args: string[]) => String(parseInt(args[0]) * parseInt(args[1])),
        argc: 2
    },
    'div': {
        fn: async (args: string[]) => String(parseInt(args[0]) / parseInt(args[1])),
        argc: 2
    },
    'divint': {
        fn: async (args: string[]) => String(Math.floor(parseInt(args[0]) / parseInt(args[1]))),
        argc: 2
    },
    'mod': {
        fn: async (args: string[]) => String(parseInt(args[0]) % parseInt(args[1])),
        argc: 2
    },
    'sub': {
        fn: async (args: string[]) => String(parseInt(args[0]) - parseInt(args[1])),
        argc: 2
    },
    'eq': {
        fn: async (args: string[]) => args[0] === args[1] ? '1' : '0',
        argc: 2
    },
    'gt': {
        fn: async (args: string[]) => (parseInt(args[0]) > parseInt(args[1])) ? '1' : '0',
        argc: 2
    },
    'lt': {
        fn: async (args: string[]) => (parseInt(args[0]) < parseInt(args[1])) ? '1' : '0',
        argc: 2
    },
    'set': {
        fn: async (args: string[]) => {variables[args[0]] = args[1]; return ''},
        argc: 2,
        lvalueIndexes: [0]
    },
    'print': {
        fn: async (args: string[]) => {
            const encoder = new TextEncoder();
            args = args.map(arg => removeEscapes(arg));
            const data = encoder.encode(args.join(' ') + variables['$0'])
            Deno.stdout.write(data);
        },
        argc: Infinity
    },
    'setnull': {
        fn: async (args: string[]) => {variables[args[0]] = ''; return ''},
        argc: 1,
        lvalueIndexes: [0]
    },
    'get': {
        fn: async (args: string[]) => variables[args[0]],
        argc: 1
    },
    'goto': {
        fn: async (args: string[]) => evalPtr = parseInt(args[0]) - 2, // -1 because it will be incremented
        argc: 1
    },
    'return': {
        fn: async (args: string[]) => {evalPtr = -2; /* -2 as it will be incremented to -1 */ console.log('Process returned: ',args[0])},
        argc: 1
    },
    'if': {
        fn: async (args: string[]) => {if(args[0] === '1') evalPtr = parseInt(args[1]) - 2},
        argc: 2
    },
    'read': {
        fn: async () => {
            const buf = new Uint8Array(1024);
            const n = await Deno.stdin.read(buf);
            let text = new TextDecoder().decode(buf.subarray(0, n ?? 0));
            
            return text.trim();
        },
        argc: 0
    },
    
}

const variables = {
    $0: '\n',
}

async function capitalizeArgs(args: string[]){
    //all to upper
    return args.map(arg => arg.toUpperCase());
}



async function transformText(text: string){
    // abc (\o \3) \2
    if(!text) return text;
    let levels = processText(text);
    while(levels.length){
        let lastLevel = levels[levels.length - 1];
        let lastLevelIndex = lastLevel[0];
        let lastLevelText = text.slice(lastLevelIndex+1);
        let lastLevelCloseIndex = lastLevelText.indexOf(')');
        let lastLevelCloseText = lastLevelText.slice(0, lastLevelCloseIndex);
        let processedText = await transformText(lastLevelCloseText);
        text = text.slice(0, lastLevelIndex) + processedText + text.slice(lastLevelIndex +2 + lastLevelCloseIndex);
        levels = processText(text);
    }

    //text = multiplyText(text);
    text = await resolveFunctions(text);
    text = removeEscapes(text);

    return text;


}

function removeEscapes(text: string){
    // "\" => ""
    // "\\" => "\"
    return text && text.replaceAll(/\\(.)/g, '$1');
}

function matchingFunctionSyntax(text:string){
    let regex = /(?<!\\)\$(\b[a-zA-Z]\w*)\s*(.*)/g;
    let match = regex.exec(text);
    return match;
}

function matchingVariableSyntax(text:string){
    let regex = /(?<!\\)\$(\d+)/g;
    let match = regex.exec(text);
    return match;
}

function matchingEmoteSyntax(text:string){
    let regex = /(?<!\\)\\(\w+)/g;
    let match = regex.exec(text);
    return match;
}


async function resolveFunctions(text: string){
    let match;
    while(match = matchingFunctionSyntax(text)){
        if(!(match[1] in funcFict)){ text = text.replaceAll(`$${match[1]}`, `\\$${match[1]}`); continue; } //@ts-ignore
        let func = funcFict[match[1]];
        if(func){
            if(func.argc){
                let args = match[2].split(' ');

                if(!func.unsafe){
                    for(let i = 0; i < args.length; i++){
                        args[i] = await resolveFunctions(args[i]);
                    }                           
                }
                
                for(let i = 0; i < args.length; i++){
                    if(matchingVariableSyntax(args[i])){
                        if(func.lvalueIndexes && func.lvalueIndexes.includes(i)) continue; //don't resolve lvalues
                        args[i] = variables[args[i]];
                    }       
                }

                let processedArgs = await func.fn(args);
                if(!processedArgs || typeof processedArgs === 'number') processedArgs = [];
                if(typeof processedArgs === 'string'){
                    processedArgs = [processedArgs];
                }
                text = text.slice(0, match.index) + processedArgs.join(' ') + text.slice(match.index + match[0].length);
            } else{
                text = text.slice(0, match.index) + (await func.fn()) + text.slice(match.index + match[1].length+1);
            }
            
        }
    }
    return text;
}

function processText(text: string) {
    const levels: number[][] = [];
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '(' && !(i > 0 && text[i - 1] === '\\')) {
            depth++;
            if (depth > levels.length) levels.push([]);
            levels[depth - 1].push(i);
        }
        if (c === ')' && !(i>0 && text[i-1] === '\\')) depth--;
    }
    return levels;
}

// read argv
const fileToProcess = Deno.args[0];

const fileData = await Deno.readTextFile(fileToProcess);

// go line by line
const lines = fileData.split('\n');

// remove comments
for(let i = 0; i < lines.length; i++){
    let line = lines[i];
    let commentIndex = line.indexOf(';');
    if(commentIndex !== -1){
        lines[i] = line.slice(0, commentIndex);
    }
}

while(evalPtr != -1){
    let line = lines[evalPtr];
    await transformText(line);
    evalPtr++;

    if(evalPtr >= lines.length) evalPtr = -1;
}


// await transformText('$set $1 10') // 30
// await transformText('$set $2 20') 
// await transformText('$print ($add $1 $2)') // 30