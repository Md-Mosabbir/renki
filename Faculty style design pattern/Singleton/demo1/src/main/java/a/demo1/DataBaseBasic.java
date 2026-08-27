package a.demo1;

public class DataBaseBasic {
    private static DataBaseBasic instance;
    private int count = 0;

    private DataBaseBasic() {
        count++;
        System.out.printf("New Instance has been created, number of instance:%d\n",count);
    }

    public void Msg(String msg){
        System.out.println("Message: "+ msg);
    }

    public static DataBaseBasic getInstance(){
        if(instance == null){
            instance = new DataBaseBasic();
        }
        return instance;
    }
}
