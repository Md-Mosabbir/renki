package a.demo;

public class Main {
    public static void main(String[] args){
        WeatherStation SomoyTV = new WeatherStation("SomoyTV");

        User u1 = new User("Siam", SomoyTV);
        User u2 = new User("Partho", SomoyTV);
        User u3 = new User("Enamul", SomoyTV);
        User u4 = new User("Ahnaf", SomoyTV);
        User u5 = new User("Mosabbir", SomoyTV);

        SomoyTV.registerClient(u1);
        SomoyTV.registerClient(u2);
        SomoyTV.registerClient(u3);
        SomoyTV.registerClient(u4);
        SomoyTV.registerClient(u5);

        SomoyTV.notifyAllUser(42.6F, 12.2F, 3.6F);

        SomoyTV.unRegisterClient(u3);

        SomoyTV.notifyAllUser(40.2F, 11.3F, 3.2F);
    }
}
