package com.guide.model;

import java.util.List;

public class Spot {
    private int id;
    private String name;
    private String brief;
    private String category;
    private String gradient;
    private String icon;
    private String history;
    private String address;
    private String openingHours;
    private String ticket;
    private String transportation;
    private List<String> highlights;
    private String imageUrl;

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getBrief() { return brief; }
    public void setBrief(String brief) { this.brief = brief; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getGradient() { return gradient; }
    public void setGradient(String gradient) { this.gradient = gradient; }
    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }
    public String getHistory() { return history; }
    public void setHistory(String history) { this.history = history; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getOpeningHours() { return openingHours; }
    public void setOpeningHours(String openingHours) { this.openingHours = openingHours; }
    public String getTicket() { return ticket; }
    public void setTicket(String ticket) { this.ticket = ticket; }
    public String getTransportation() { return transportation; }
    public void setTransportation(String transportation) { this.transportation = transportation; }
    public List<String> getHighlights() { return highlights; }
    public void setHighlights(List<String> highlights) { this.highlights = highlights; }
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
}
