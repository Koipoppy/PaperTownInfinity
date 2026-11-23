#target photoshop
app.displayDialogs = DialogModes.NO;

var inDir = new Folder("C:/Users/chenyuchong/Products/程序生成无限可交互立体书世界/assets_src/props");
var outDir = new Folder("C:/Users/chenyuchong/Products/程序生成无限可交互立体书世界/assets_src/props_cut");
if (!outDir.exists) outDir.create();

var files = inDir.getFiles("*.png");
var log = [];
for (var i = 0; i < files.length; i++) {
    var file = files[i];
    var name = file.name;
    var doc = null;
    try {
        doc = app.open(file);
        executeAction(stringIDToTypeID("removeBackground"), undefined, DialogModes.NO);
        var out = new File(outDir.fsName + "/" + name);
        var opts = new PNGSaveOptions();
        opts.compression = 6;
        opts.interlaced = false;
        doc.saveAs(out, opts, true, Extension.LOWERCASE);
        log.push("OK " + name);
    } catch (e) {
        log.push("FAIL " + name + " :: " + e.message + " (line " + e.line + ")");
    } finally {
        if (doc) {
            try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) {}
        }
    }
}

var logFile = new File(outDir.fsName + "/_log.txt");
logFile.encoding = "UTF8";
logFile.open("w");
logFile.write(log.join("\n"));
logFile.close();
log.join(" | ");
