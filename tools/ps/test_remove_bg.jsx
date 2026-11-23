#target photoshop
app.displayDialogs = DialogModes.NO;

var inputPath = "C:/Users/chenyuchong/Products/程序生成无限可交互立体书世界/assets_src/props/tree_oak.png";
var outputPath = "C:/Users/chenyuchong/Products/程序生成无限可交互立体书世界/assets_src/props_test/tree_oak_ps.png";

var log = [];
var doc = null;
try {
    doc = app.open(new File(inputPath));
    log.push("opened " + doc.width + "x" + doc.height + " layers=" + doc.layers.length);
    try {
        executeAction(stringIDToTypeID("removeBackground"), undefined, DialogModes.NO);
        log.push("removeBackground ok");
    } catch (e1) {
        log.push("removeBackground fail: " + e1.message);
        try {
            executeAction(stringIDToTypeID("autoCutout"), undefined, DialogModes.NO);
            log.push("autoCutout ok");
        } catch (e2) {
            log.push("autoCutout fail: " + e2.message);
        }
    }
    log.push("layers after=" + doc.layers.length);
    try {
        log.push("mask=" + doc.layers[0].layerMask);
    } catch (e3) {
        log.push("mask read fail");
    }
    var out = new File(outputPath);
    var opts = new PNGSaveOptions();
    opts.compression = 6;
    opts.interlaced = false;
    doc.saveAs(out, opts, true, Extension.LOWERCASE);
    log.push("saved");
} catch (e) {
    log.push("ERROR " + e.message + " line " + e.line);
} finally {
    if (doc) {
        try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (e4) {}
    }
}
log.join(" | ");
