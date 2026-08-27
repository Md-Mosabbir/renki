package a.demo;

import java.util.ArrayList;
import java.util.List;

public class WeatherStation implements Subject{
    private String stationName;
    List<Observer> users = new ArrayList<>();

    public WeatherStation(){
        this.stationName = "";
    }

    public WeatherStation(String stationName) {
        this.stationName = stationName;
    }

    public String getStationName() {
        return stationName;
    }

    @Override
    public void registerClient(User user) {
        users.add(user);
    }

    @Override
    public void unRegisterClient(User user) {
        users.remove(user);
        System.out.println("User:"+user.getUserName()+" Unregistered");
        System.out.printf("User: %s Unregistered\n",user.getUserName());

    }

    @Override
    public void notifyAllUser(float temp, float humidity, float pressure) {
        for(Observer u: users){
            u.notifyWeather(temp,humidity,pressure);
        }
    }
}
