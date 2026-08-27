package a.demo;

public interface Subject {
    void registerClient(User user);
    void unRegisterClient(User user);

    void notifyAllUser(float temp,float humidity,float pressure);
}
