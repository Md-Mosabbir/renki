package a.proxy_design_pattern;

public class RealDocument implements Document{

    public RealDocument() {
        System.out.println("[System] Loading heavy 500-page PDF into memory...");
    }

    @Override
    public void displayDocument(String role){
        System.out.println("Displaying the document for:"+role);
    }
}
