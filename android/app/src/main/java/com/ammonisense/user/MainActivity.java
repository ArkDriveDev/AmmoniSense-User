package com.ammonisense.user;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import ee.forgr.plugin.bluetooth_low_energy.BluetoothLowEnergyPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BluetoothLowEnergyPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
