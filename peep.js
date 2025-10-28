// Change 1: Replace all Module.getExportByName with Process.getModuleByName("kernel32.dll").getExportByName
var writeFile = Process.getModuleByName("kernel32.dll").getExportByName("WriteFile");
var readFile = Process.getModuleByName("kernel32.dll").getExportByName("ReadFile");
var createFileA = Process.getModuleByName("kernel32.dll").getExportByName("CreateFileA");
var createFileW = Process.getModuleByName("kernel32.dll").getExportByName("CreateFileW");
var createNamedPipeA = Process.getModuleByName("kernel32.dll").getExportByName("CreateNamedPipeA");
var createNamedPipeW = Process.getModuleByName("kernel32.dll").getExportByName("CreateNamedPipeW");
var callNamedPipe = Process.getModuleByName("kernel32.dll").getExportByName("CallNamedPipeA");
var createPipe = Process.getModuleByName("kernel32.dll").getExportByName("CreatePipe");

// Change 2: Replace Module.findExportByName with Process.getModuleByName("kernel32.dll").getExportByName
var getFileTypeAddr = Process.getModuleByName("kernel32.dll").getExportByName('GetFileType');
var getFileType = new NativeFunction(getFileTypeAddr, 'uint32',['pointer']);

var isPipe = 0;
var pipename;
var pipeHandlers = {};
var otherHandlers = {};
var filename;
var readbuff = 0x0;
var outLenght;

// Change 3: Replace Memory.readCString(ptr) with ptr.readCString()
// Cange 4: Replace Memory.readUtf16String(ptr) with ptr.readUtf16String()
// Change 5: Replace Memory.readInt(ptr) with ptr.readInt()

Interceptor.attach(writeFile, {
    onEnter: function(args)
    {
        var len = args[2].toInt32();
        if (args[0] in pipeHandlers)
        {
            console.log("\nThread: "+Process.getCurrentThreadId())
            console.log("> Writing to Pipe: "+pipeHandlers[args[0]]);
            console.log("> Content:\n" + hexdump(args[1], {length: len}))+"\n";
        }
        else if (args[0] in otherHandlers)
        {
        }
        else
        {
            var type = getFileType(args[0]);
            if (type == 3)
            {
                pipeHandlers[args[0]] = args[0];
                console.log("\nThread: "+Process.getCurrentThreadId())
                console.log("> Writing to Pipe: "+pipeHandlers[args[0]]);
                console.log("> Content:\n" + hexdump(args[1], {length: len}))+"\n";
            }
            else
            {
                otherHandlers[args[0]] = '';
            }
        }
    }
});

Interceptor.attach(readFile, {
    onEnter: function(args)
    {
        outLenght = args[3];
        if (args[0] in pipeHandlers)
        {
            console.log("\nThread: "+Process.getCurrentThreadId())
            console.log("< Reading from Pipe: "+pipeHandlers[args[0]]);
            readbuff = args[1];
        }
        else if (args[0] in otherHandlers)
        {
        }
        else
        {
            var type = getFileType(args[0]);
            if (type == 3)
            {
                pipeHandlers[args[0]] = args[0];
                console.log("\nThread: "+Process.getCurrentThreadId())
                console.log("< Reading from Pipe: "+pipeHandlers[args[0]]);
                readbuff = args[1];
            }
            else
            {
                otherHandlers[args[0]] = '';
            }

        }
    },
    onLeave: function(retval)
    {
        if (!(readbuff == 0x0))
        {
            var len = outLenght.readInt(); // CHANGED: Memory.readInt() -> ptr.readInt()
            console.log("< Content:\n" + hexdump(readbuff, {length: len}) + "\n");
            readbuff = 0x0;
        }
    }
});

Interceptor.attach(createFileA, {
    onEnter: function(args)
    {
        if (args[0].readCString().includes("\\\\.\\pipe")) // altered Memory.readCString() with ptr.readCString()
        {
            isPipe = 1;
            pipename = args[0].readCString(); // again altered Memory.readCString() with ptr.readCString()
        }
        else
        {
            isPipe = 0;
        }    
    },
    onLeave: function(retval) 
    {
        if (isPipe == 1)
        {
            if (!(retval in pipeHandlers))
            {
                pipeHandlers[retval] = pipename;
            }
            isPipe = 0;
        }
        else
        {
            if (!(retval in otherHandlers))
            {
                otherHandlers[retval] = '';
            }
        }
    }
});

Interceptor.attach(createFileW, {
    onEnter: function(args)
    {
        if (args[0].readUtf16String().includes("\\\\.\\pipe")) // replaced Memory.readUtf16String() with ptr.readUtf16String()
        {
            isPipe = 1;
            pipename = args[0].readUtf16String(); //same replacement as noted above
        }
        else
        {
            isPipe = 0;
        }
    
    },
    onLeave: function (retval) 
    {
        if (isPipe == 1)
        {
            if (!(retval in pipeHandlers))
            {
                pipeHandlers[retval] = pipename;
            }
            isPipe = 0;
        }
        else
        {
            if (!(retval in otherHandlers))
            {
                otherHandlers[retval] = '';
            }
        }
    }
});

Interceptor.attach(createNamedPipeA, {
    onEnter: function(args)
    {
        console.log("\nPipename: "+args[0].readCString()); // replaced Memory.readCString() -> ptr.readCString()
        
        console.log("Open Mode: "+args[1]);
        if (args[1] == 0x3)
        {
            console.log("Pipe is Duplex");
        }
        else if (args[1] == 0x1)
        {
            console.log("Pipe is Read Only");
        }
        else if (args[1] == 0x2)
        {
            console.log("Pipe is Write Only");
        }
        else 
        {
            console.log("Double-check mode:\nhttps://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createnamedpipea");
        }
        if ((args[2] & (1 << 2)) > 0)
        {
            console.log("Pipe is in MESSAGE mode");
        }
        else
        {
            console.log("Pipe is in BYTE mode");
        }
        if ((args[2] & (1 << 1)) > 0)
        {
            console.log("Pipe is in MESSAGE read mode");
        }
        else 
        {
            console.log("Pipe is in BYTE read mode");
        }
        if ((args[2] & (1 << 3)) > 0)
        {
            console.log("Pipe rejects remote clients");
        }
        else 
        {
            console.log("Pipe accepts remote clients");
        }
        pipename = args[0].readCString(); 
    },
    onLeave: function (retval) 
    {
        pipeHandlers[retval] = pipename;
    }
});

Interceptor.attach(createNamedPipeW, {
    onEnter: function(args)
    {
        console.log("\nPipename: "+args[0].readUtf16String()); 
        console.log("Mode: "+args[1]);
        if (args[1] == 0x3)
        {
            console.log("Pipe is Duplex");
        }
        else if (args[1] == 0x1)
        {
            console.log("Pipe is Read Only");
        }
        else if (args[1] == 0x2)
        {
            console.log("Pipe is Write Only");
        }
        else 
        {
            console.log("Double-check mode:\nhttps://learn.microsoft.com/en-us/windows/win32/api/namedpipeapi/nf-namedpipeapi-createnamedpipew");
        }
        console.log("Pipe Mode: "+args[2]);
        if ((args[2] & (1 << 2)) > 0)
        {
            console.log("Pipe is in MESSAGE mode");
        }
        else
        {
            console.log("Pipe is in BYTE mode");
        }
        if ((args[2] & (1 << 1)) > 0)
        {
            console.log("Pipe is in MESSAGE read mode");
        }
        else 
        {
            console.log("Pipe is in BYTE read mode");
        }
        if ((args[2] & (1 << 3)) > 0)
        {
            console.log("Pipe rejects remote clients");
        }
        else 
        {
            console.log("Pipe accepts remote clients");
        }
        pipename = args[0].readUtf16String(); 
    },
    onLeave: function (retval) 
    {
        pipeHandlers[retval] = pipename;
    }
});

Interceptor.attach(callNamedPipe, {
    onEnter: function(args)
    {
        console.log("\nTransactional Pipename: "+args[0].readCString()); 
    }   
});

Interceptor.attach(createPipe, {
    onEnter: function(args)
    {
        console.log("\nAnonymous Pipe Created\nRead Handler: "+args[0]+"\nWrite Handler: "+args[1]);
        pipeHandlers[args[0]] = "Anonymous";
    }   
});
