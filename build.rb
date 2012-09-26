#!/usr/bin/env ruby

dir = File.absolute_path(File.dirname(__FILE__))
template = "// File -- %s\n%s"

out = []

Dir.glob(File.join(dir, 'lib', '*')).push(File.join(dir, 'index.js')).each do |path|
	path = File.absolute_path(path, dir)

	File.open(path, 'r') do |f|
		out << template % [path.gsub(dir, '/').gsub(/^\/*/, './'), f.read()]
	end
end

File.open(File.join(dir, 'jquery-observe.js'), 'w') do |f|
	f.write(out.join("\n"))
end
