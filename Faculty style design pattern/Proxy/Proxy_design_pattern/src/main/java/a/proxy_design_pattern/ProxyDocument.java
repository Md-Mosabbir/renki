package a.proxy_design_pattern;

import java.util.ArrayList;
import java.util.List;

public class ProxyDocument implements Document{
    private RealDocument realDocument;
    private static final List<String> allowedUser = new ArrayList<>();

    static{
        allowedUser.add("ADMIN");
        allowedUser.add("PARALEGAL");
    }

    @Override
    public void displayDocument(String role){
        if(!allowedUser.contains(role)){
            System.out.println("ACCESS DENIED TO "+ role);
            return;
        }
        if(realDocument == null){
            realDocument = new RealDocument();
        }
        realDocument.displayDocument(role);


    }

}
