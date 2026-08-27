package a.demo;

public class User implements Observer{
    private String userName;
    private WeatherStation wStation;

    public User(String userName, WeatherStation wStation) {
        this.userName = userName;
        this.wStation = wStation;
    }

    public String getUserName() {
        return userName;
    }

    @Override
    public void notifyWeather(float temp,float humidity,float pressure) {
        System.out.println("Hey "+userName+", Weather Update: Temperature:"+temp+"," +
                "Humidity:"+humidity+", Pressure:"+pressure+" from Station:"+wStation.getStationName());
    }
}
