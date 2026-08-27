package a.proxy_design_pattern;

/*
Scenario-Based Practice Question
Scenario: You are building a high-performance document viewer for a legal firm. The application loads confidential PDF documents.

Loading a 500-page PDF file into memory from storage takes substantial memory and rendering time.

Only users with the role "ADMIN" or "PARALEGAL" should be permitted to open confidential documents.

Task: Design and implement a system using the Proxy Design Pattern to solve both issues:

Implement a Protection & Virtual Proxy named DocumentProxy.

Ensure the document is loaded into memory only when a permitted user requests to display it (lazy loading).

Block unauthorized users (e.g., role "GUEST") from viewing confidential files and display an access error.
*/



public class Main {
    public static void main(String[] args){
        Document document = new ProxyDocument();

        document.displayDocument("ADMIN");
        document.displayDocument("GUEST");
        document.displayDocument("USER");
        document.displayDocument("PARALEGAL");
    }
}
