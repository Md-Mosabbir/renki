package a.demo1;

public class DB_Thread {
    private static volatile DB_Thread instance;
    private int count = 0;

    private DB_Thread(){
        count++;
        System.out.printf("New Instance has been created, number of instance:%d\n",count);
    }

    public static DB_Thread getInstance(){
        if(instance==null){
            synchronized (DB_Thread.class){
                if(instance==null){
                    instance = new DB_Thread();
                }
            }
        }
        return instance;
    }
}
