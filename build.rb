#!/usr/bin/env ruby

require 'net/http'
require 'uri'
require 'optparse'
require 'tmpdir'

options = {}

GOOGLE_CLOSURE_COMPILER = URI.parse('http://closure-compiler.appspot.com/compile')
OUT_PATH = 'jquery-observe.js'

OptionParser.new { |opts|
	opts.banner = 'Usage: build.rb [options]'

	opts.on('-m', '--minify', 'Minify souce using the Google Closure Compiler') do 
		options[:minify] = true
	end

	opts.on('-j', '--jshint', 'Run the source trough JSHint') do
		options[:jshint] = true
	end
}.parse!

def minify(src)
	Net::HTTP.start(GOOGLE_CLOSURE_COMPILER.host, GOOGLE_CLOSURE_COMPILER.port) do |http|
		request = Net::HTTP::Post.new(GOOGLE_CLOSURE_COMPILER.request_uri)
		request.set_form_data({
			:js_code => src,
			:compilation_level => 'SIMPLE_OPTIMIZATIONS',
			:output_format => 'text',
			:output_info => 'compiled_code'
		})

		response = http.request(request)

		response.value
		response.body
	end
end

def jshint(*args)
	if not %x(which jshint).empty?
		%x(jshint #{args.join(' ')})
	end
end

dir = File.absolute_path(File.dirname(__FILE__))
template = "// File -- %s\n%s"

out = []

Dir.glob(File.join(dir, 'lib', '*')).push(File.join(dir, 'index.js')).each do |path|
	path = File.absolute_path(path, dir)

	File.open(path, 'r') do |f|
		out << template % [path.gsub(dir, '/').gsub(/^\/*/, './'), f.read]
	end
end

out = out.join("\n")

if options[:jshint]
	tmp = File.join(Dir.tmpdir, OUT_PATH)

	File.open(tmp, 'w') do |f|
		f.write(out);
	end

	puts jshint(tmp)
end

out = options[:minify] ? minify(out) : out 

File.open(File.join(dir, OUT_PATH), 'w') do |f|
	f.write(out)
end
