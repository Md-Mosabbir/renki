package a.demo1;

public class Main {
    public static void DB1(){
        DB_Thread DB1 = DB_Thread.getInstance();
        System.out.println("This is for DB1");
    }

    public static void DB2(){
        DB_Thread DB1 = DB_Thread.getInstance();
        System.out.println("This is for DB2");
    }

    public static void main(String[] args){
//        DataBaseBasic DB1 = DataBaseBasic.getInstance();
//        DB1.Msg("This msg is from DB1.");
//
//        DataBaseBasic DB2 = DataBaseBasic.getInstance();
//        DB1.Msg("This msg is from DB2.");
//
//        if(DB1==DB2){
//            System.out.println("Same instance for both");
//        }
//        else{
//            System.out.println("NOT Same instance for both");
//        }
//
//        System.out.println("DB1 hashcode: " + System.identityHashCode(DB1));
//        System.out.println("DB2 hashcode: " + System.identityHashCode(DB2));

        Thread t1 = new Thread(Main::DB1);
        Thread t2 = new Thread(Main::DB2);

        t1.start();
        t2.start();
    }
}
