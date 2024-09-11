
# Custom Tdarr Classic Plugins I made and use
Here are the custom plugins I've made for Tdarr. These plugins help with streamlining media processing, debugging, and organizing stream data.

### Tdarr_Classic_Plugin_ChasilPrintStreamInfos
This classic plugin prints out information about the different streams. The information can be shown in the report or logfile. I use it primarily for debugging purposes.

Example output inside report:

![Example output inside report](./img/print_stream_infos_example.png)

## Installation Guide

To install and use any of these Tdarr plugins, follow these steps:

1. **Download the Plugin**
   Clone the repository or download the specific branch for the plugin you want to use:
   ```
   git clone -b <plugin-branch-name> https://github.com/deso85/Tdarr-Classic-Plugins.git
   ```

2. **Add the Plugin to Tdarr**
   Copy the plugin file from the cloned repository to your Tdarr plugin folder, which is usually located at:
   ```
   /path/to/tdarr/server/Tdarr/Plugins/Local
   ```

3. **Enable the Plugin in Tdarr**
   - Open Tdarr.
   - Navigate to the **Classic Plugins** section.
   - Find the custom plugin you want to use from the available plugins list and configure it to your needs if possible.
   - Enable the plugin for your desired library or node.

4. **Usage**
   - Go to the **Libraries** sectiom
   - Edit an existing library or create a new one
   - Go to **Transcoder Options** and add the Plugin
   
   Tdarr will apply it during the transcoding or media processing tasks associated with that Library.